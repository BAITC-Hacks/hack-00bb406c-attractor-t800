import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app, get_db


class RecommendationApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(self.connection, join_transaction_mode='create_savepoint')
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.client.post('/api/demo/login', json={'operator': True})
        self.client.put('/api/operator/clock', json={'as_of_date': '2026-10-01'})
        self.client.post('/api/demo/login', json={'employee_id': 'E0174'})
        self.env = patch.dict(os.environ, {'OPENAI_API_KEY': ''})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.client.close()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()
        app.dependency_overrides.clear()

    def recommendations(self):
        response = self.client.get('/api/me/recommendations')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_missing_key_returns_useful_explained_rules_without_writes(self):
        before = self.client.get('/api/me/profile').json()
        result = self.recommendations()
        self.assertEqual(result['mode'], 'rules')
        self.assertEqual(result['fallback_reason'], 'missing_key')
        ids = [card['event_id'] for card in result['recommendations']]
        self.assertIn('EV_032', ids)
        self.assertIn('EV_033', ids)
        for card in result['recommendations']:
            self.assertTrue(card['effects'])
            self.assertGreaterEqual(len(card['explanation']), 4)
            self.assertEqual(self.client.get(card['activity_url']).status_code, 200)
        self.assertEqual(self.client.get('/api/me/profile').json(), before)
        self.assertLess(result['elapsed_ms'], 10000)

    def test_conflicting_history_prefers_two_gaps_over_repeated_no_shows(self):
        from datetime import date
        from app.models import ActivityHistory
        for index, when in enumerate((date(2026, 9, 10), date(2026, 9, 24))):
            self.db.add(ActivityHistory(record_id=f'TEST_NO_SHOW_{index}', employee_id='E0174', event_id='EV_036', date=when, status='no_show', completion_pct=0, assigned_by='self'))
        self.db.flush()
        result = self.recommendations()
        ids = [c['event_id'] for c in result['recommendations']]
        self.assertIn('EV_033', ids)
        if 'EV_036' in ids:
            self.assertLess(ids.index('EV_033'), ids.index('EV_036'))
        chosen = next(c for c in result['recommendations'] if c['event_id'] == 'EV_033')
        self.assertEqual({e['skill_id'] for e in chosen['effects']}, {'SK_PROSPECTING', 'SK_CRM'})
        self.assertTrue(any('EV_036' in text and ': 2' in text for text in chosen['explanation']))

    def test_provider_receives_only_useful_anonymous_candidates_and_valid_output_is_ai(self):
        import json
        from unittest.mock import AsyncMock
        from app.infrastructure.openai_recommendations import OpenAIRecommendationModel
        model = AsyncMock(return_value={'recommendations': [{'event_id': 'EV_033', 'reasons': ['critical_gap', 'multiple_gaps']}]})
        with patch.object(OpenAIRecommendationModel, 'select', model):
            result = self.recommendations()
        self.assertEqual(result['mode'], 'ai')
        self.assertEqual([c['event_id'] for c in result['recommendations']], ['EV_033'])
        context = model.call_args.args[0]
        serialized = json.dumps(context)
        for forbidden in ('employee_id', 'full_name', 'manager_id', 'record_id', 'E0174', 'title', 'description'):
            self.assertNotIn(forbidden, serialized)
        self.assertEqual(context['current']['grade'], 'Junior')
        self.assertTrue(context['requirements'])
        self.assertTrue(all('required_level' in r and 'calculated_level' in r for r in context['requirements']))
        for candidate in context['candidates']:
            self.assertTrue(candidate['gain_rules'])
            self.assertTrue(all(e['gap_after'] < e['gap_before'] for e in candidate['effects']))
            self.assertNotEqual(candidate['event_id'], 'EV_001')

    def test_invalid_model_responses_are_never_published(self):
        from unittest.mock import AsyncMock
        from app.infrastructure.openai_recommendations import OpenAIRecommendationModel
        valid = {'event_id': 'EV_033', 'reasons': ['critical_gap']}
        for answer in (None, {}, {'recommendations': []}, {'recommendations': [valid, valid]},
                       {'recommendations': [{'event_id': 'INVENTED', 'reasons': ['reduces_gap']}]},
                       {'recommendations': [{'event_id': 'EV_033', 'reasons': ['continue']}]},
                       {'recommendations': [{**valid, 'fact': 'promotion guaranteed'}]},
                       {'recommendations': [{'event_id': 'EV_033', 'reasons': []}]}):
            with self.subTest(answer=answer), patch.object(OpenAIRecommendationModel, 'select', AsyncMock(return_value=answer)):
                result = self.recommendations()
                self.assertEqual(result['mode'], 'rules')
                self.assertEqual(result['fallback_reason'], 'invalid_response')

    def test_no_step_skips_model_and_explains_absent_target_profile(self):
        from app.models import Employee
        from unittest.mock import AsyncMock
        from app.infrastructure.openai_recommendations import OpenAIRecommendationModel
        employee = self.db.get(Employee, 'E0174')
        employee.career_goal = {'target_role': 'Unavailable role', 'target_grade': 'Lead'}
        self.db.flush()
        model = AsyncMock()
        with patch.object(OpenAIRecommendationModel, 'select', model):
            result = self.recommendations()
        self.assertEqual(result['mode'], 'no_step')
        self.assertEqual(result['recommendations'], [])
        self.assertFalse(result['target']['profile_available'])
        self.assertIn('Нет профиля требований для выбранного ориентира', result['excluded_reasons'])
        model.assert_not_called()

    def test_access_is_scoped_to_current_employee(self):
        self.client.post('/api/demo/login', json={'operator': True})
        self.assertEqual(self.client.get('/api/me/recommendations').status_code, 403)
        self.client.delete('/api/session')
        self.assertEqual(self.client.get('/api/me/recommendations').status_code, 401)

    def test_real_adapter_request_and_provider_failures(self):
        import json
        import httpx
        from unittest.mock import AsyncMock
        answer = {'recommendations': [{'event_id': 'EV_033', 'reasons': ['multiple_gaps']}]}
        request = httpx.Request('POST', 'https://api.openai.com/v1/responses')
        responses = [
            (httpx.Response(200, request=request, json={'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(answer)}]}]}), 'ai', None),
            (httpx.Response(503, request=request), 'rules', 'provider_error'),
            (httpx.Response(200, request=request, json={'status': 'incomplete', 'output': []}), 'rules', 'invalid_response'),
            (httpx.Response(200, request=request, json={'status': 'completed', 'output': [None]}), 'rules', 'invalid_response'),
            (httpx.Response(200, request=request, json={'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'refusal', 'refusal': 'no'}]}]}), 'rules', 'invalid_response'),
        ]
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only-key'}):
            for response, mode, reason in responses:
                with self.subTest(mode=mode, reason=reason), patch('httpx.AsyncClient.post', AsyncMock(return_value=response)) as post:
                    result = self.recommendations()
                    self.assertEqual((result['mode'], result['fallback_reason']), (mode, reason))
                    payload = post.call_args.kwargs['json']
                    self.assertFalse(payload['store'])
                    self.assertEqual(payload['text']['format']['type'], 'json_schema')
                    self.assertEqual(payload['model'], 'gpt-4.1-mini-2025-04-14')

    def test_slow_provider_is_cancelled_at_eight_seconds(self):
        import asyncio
        import time
        from unittest.mock import AsyncMock
        async def slow(*args, **kwargs):
            await asyncio.sleep(30)
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only-key'}), patch('httpx.AsyncClient.post', AsyncMock(side_effect=slow)):
            start = time.monotonic()
            result = self.recommendations()
            elapsed = time.monotonic() - start
        self.assertEqual((result['mode'], result['fallback_reason']), ('rules', 'timeout'))
        self.assertGreaterEqual(elapsed, 8)
        self.assertLess(elapsed, 10)
        print(f'Cold timeout HTTP request: {elapsed:.3f}s; server: {result["elapsed_ms"]}ms')

    def test_three_new_profiles_and_completed_or_unavailable_candidates(self):
        from datetime import date
        from app.models import Employee, Event, ActivityHistory
        from unittest.mock import AsyncMock
        from app.infrastructure.openai_recommendations import OpenAIRecommendationModel
        import time
        source = self.db.get(Employee, 'E0174')
        for index, goal in enumerate((None, {'target_role': 'Sales Manager', 'target_grade': 'Middle'}, {'target_role': 'Data Analyst', 'target_grade': 'Middle'})):
            values = {c.name: getattr(source, c.name) for c in Employee.__table__.columns}
            values.update(employee_id=f'TEST_JURY_{index}', full_name=f'Synthetic jury {index}', career_goal=goal)
            self.db.add(Employee(**values))
        self.db.flush()
        self.db.get(Event, 'EV_032').upcoming_sessions = ['2026-09-01']
        self.db.get(Event, 'EV_033').prerequisites = {'SK_PROSPECTING': 5}
        self.db.add(ActivityHistory(record_id='TEST_DONE', employee_id='TEST_JURY_0', event_id='EV_034', date=date(2026, 9, 1), status='completed', completion_pct=100, assigned_by='self'))
        self.db.flush()
        for index in range(3):
            self.client.post('/api/demo/login', json={'employee_id': f'TEST_JURY_{index}'})
            start = time.monotonic()
            result = self.recommendations()
            self.assertLess(time.monotonic() - start, 10)
            self.assertEqual(result['target']['kind'], 'provisional' if index == 0 else 'goal')
            model = AsyncMock(return_value={})
            with patch.object(OpenAIRecommendationModel, 'select', model):
                self.recommendations()
            if model.called:
                ids = {c['event_id'] for c in model.call_args.args[0]['candidates']}
                self.assertFalse(ids & {'EV_001', 'EV_032', 'EV_033'})
                if index == 0:
                    self.assertNotIn('EV_034', ids)
            print(f'Cold synthetic profile {index}: {result["elapsed_ms"]}ms, {result["mode"]}')

    def test_no_step_distinguishes_completed_from_expired(self):
        from datetime import date
        from app.models import Event, ActivityHistory
        for event in self.db.query(Event).all():
            event.mandatory = event.event_id != 'EV_032'
        event = self.db.get(Event, 'EV_032')
        event.upcoming_sessions = ['2026-09-01']
        self.db.flush()
        expired = self.recommendations()
        self.assertEqual(expired['mode'], 'no_step')
        self.assertIn('Нет будущей незавершённой сессии', expired['excluded_reasons'])
        self.db.add(ActivityHistory(record_id='TEST_COMPLETED_032', employee_id='E0174', event_id='EV_032', date=date(2026, 9, 1), status='completed', completion_pct=100, assigned_by='self'))
        self.db.flush()
        completed = self.recommendations()
        self.assertEqual(completed['mode'], 'no_step')
        self.assertIn('Активность уже завершена', completed['excluded_reasons'])

    def test_empty_catalog_has_a_reason(self):
        from app.models import Event, ActivityHistory
        self.db.query(ActivityHistory).delete()
        self.db.query(Event).delete()
        self.db.flush()
        result = self.recommendations()
        self.assertEqual(result['mode'], 'no_step')
        self.assertEqual(result['excluded_reasons'], {'Каталог активностей пуст': 1})

    def test_startup_reports_key_and_model_access_without_claiming_generation(self):
        import httpx
        from unittest.mock import AsyncMock
        with TestClient(app) as client:
            self.assertEqual(client.get('/api/health').json()['ai_readiness'], 'missing_key')
        model = 'gpt-4.1-mini-2025-04-14'
        response = httpx.Response(200, request=httpx.Request('GET', f'https://api.openai.com/v1/models/{model}'), json={'id': model})
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only-key'}), patch('httpx.AsyncClient.get', AsyncMock(return_value=response)):
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/health').json()['ai_readiness'], 'model_accessible')
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only-key'}), patch('httpx.AsyncClient.get', AsyncMock(side_effect=httpx.ConnectError('offline'))):
            with TestClient(app) as client:
                self.assertEqual(client.get('/api/health').json()['ai_readiness'], 'provider_error')

    def test_completed_event_is_excluded_even_with_conflicting_active_participation(self):
        from datetime import date
        from app.models import ActivityHistory
        from unittest.mock import AsyncMock
        from app.infrastructure.openai_recommendations import OpenAIRecommendationModel
        for status in ('completed', 'planned'):
            self.db.add(ActivityHistory(record_id=f'TEST_CONFLICT_{status}', employee_id='E0174', event_id='EV_032', date=date(2026, 9, 1) if status == 'completed' else date(2026, 10, 15), status=status, completion_pct=100 if status == 'completed' else 0, assigned_by='self'))
        self.db.flush()
        model = AsyncMock(return_value={})
        with patch.object(OpenAIRecommendationModel, 'select', model):
            self.recommendations()
        self.assertNotIn('EV_032', [c['event_id'] for c in model.call_args.args[0]['candidates']])
