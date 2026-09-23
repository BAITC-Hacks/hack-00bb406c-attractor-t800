"""HR HTTP contracts on a rollback-only database, including small-group privacy."""
import unittest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app, get_db


class HrApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(self.connection, join_transaction_mode='create_savepoint')
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.client.post('/api/demo/login', json={'operator': True})
        self.client.put('/api/operator/clock', json={'as_of_date': '2026-10-01'})

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()
        app.dependency_overrides.clear()

    def hr_login(self):
        response = self.client.post('/api/demo/login', json={'actor_role': 'hr'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {'actor_role': 'hr', 'employee_id': None})

    def summary(self, department=None):
        response = self.client.get('/api/hr/summary', params={'department': department} if department else {})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_hr_gets_three_sections_without_private_profiles(self):
        self.hr_login()
        result = self.summary()
        self.assertEqual(result['employee_count'], 200)
        self.assertTrue(result['skill_gaps'])
        self.assertTrue(result['participation'])
        self.assertIn('no_step', result)
        self.assertEqual(result['privacy']['minimum_group_size'], 5)
        for row in result['skill_gaps']:
            self.assertEqual(set(row), {'skill_id', 'name', 'employee_count'})
        for row in result['no_step']:
            self.assertEqual(set(row), {'employee_id', 'full_name', 'department'})
        for path in ('/api/me/profile', '/api/employees/E0174', '/api/me/activities', '/api/me/recommendations'):
            self.assertEqual(self.client.get(path).status_code, 403, path)
        self.assertEqual(self.client.get('/api/session').json()['actor_name'], 'HR')

    def create_cohort(self, department, count, skill_level=2):
        from copy import deepcopy
        from datetime import date
        from app.models import Employee, RoleProfile
        source = self.db.get(Employee, 'E0174')
        required = self.db.query(RoleProfile).filter_by(role='Sales Manager', grade='Middle').one().required_skills
        ids = []
        for index in range(count):
            employee_id = f'TEST_{department}_{index}'
            values = {c.name: deepcopy(getattr(source, c.name)) for c in Employee.__table__.columns}
            values.update(employee_id=employee_id, full_name=f'Fixture {department} {index}', department=department,
                          last_review_date=date(2026, 10, 1), career_goal={'target_role': 'Sales Manager', 'target_grade': 'Middle'},
                          skills={**required, 'SK_NEGOTIATION': skill_level})
            self.db.add(Employee(**values))
            ids.append(employee_id)
        self.db.flush()
        return ids

    def test_department_under_five_hides_aggregates_but_keeps_minimal_no_step(self):
        ids = self.create_cohort('Small', 4, skill_level=5)
        self.hr_login()
        result = self.summary('Small')
        self.assertTrue(result['privacy']['aggregates_suppressed'])
        self.assertEqual(result['skill_gaps'], [])
        self.assertEqual(result['participation'], [])
        self.assertEqual({row['employee_id'] for row in result['no_step']}, set(ids))
        self.assertTrue(all(set(row) == {'employee_id', 'full_name', 'department'} for row in result['no_step']))
        self.assertEqual(self.client.get('/api/hr/summary?department=Missing').status_code, 404)
        self.assertEqual(self.client.get('/api/hr/summary?department=Small%27%20OR%201%3D1').status_code, 404)

    def test_small_cells_and_complements_cannot_be_recovered_from_company_total(self):
        from app.models import Employee
        ids = self.create_cohort('Sensitive', 10)
        for employee_id in ids[:4]:
            person = self.db.get(Employee, employee_id)
            person.skills = {**person.skills, 'SK_NEGOTIATION': 5}
        self.db.flush()
        self.hr_login()
        def gap(result):
            return next(row['employee_count'] for row in result['skill_gaps'] if row['skill_id'] == 'SK_NEGOTIATION')
        # Six gaps with four non-gaps still disclose a small complement.
        self.assertIsNone(gap(self.summary('Sensitive')))
        self.assertIsNone(gap(self.summary()))
        person = self.db.get(Employee, ids[4])
        person.skills = {**person.skills, 'SK_NEGOTIATION': 5}
        self.db.flush()
        self.assertEqual(gap(self.summary('Sensitive')), 5)

    def test_participation_counts_people_not_duplicate_history_rows(self):
        from datetime import date
        from app.models import ActivityHistory
        ids = self.create_cohort('Participation', 12)
        for index in range(5):
            self.db.add(ActivityHistory(record_id=f'TEST_DUPLICATE_{index}', employee_id=ids[0], event_id='EV_036', date=date(2026, 9, index + 1), status='no_show', completion_pct=0, assigned_by='self'))
        self.db.flush()
        self.hr_login()
        result = self.summary('Participation')
        row = next(row for row in result['participation'] if row['event_id'] == 'EV_036')
        self.assertIsNone(row['participants'])
        self.assertIsNone(row['completed'])

    def test_completion_refreshes_gaps_participation_and_no_step_without_model(self):
        from datetime import date
        from app.models import ActivityHistory, Event
        from unittest.mock import AsyncMock, patch
        from app.infrastructure.openai_recommendations import OpenAIRecommendationModel
        ids = self.create_cohort('Learning', 12)
        for event in self.db.query(Event).all():
            event.mandatory = event.event_id != 'EV_032'
        for index in range(6):
            self.db.add(ActivityHistory(record_id=f'TEST_LEARNING_{index}', employee_id=ids[index], event_id='EV_032', date=date(2026, 10, 15), status='completed', completion_pct=100, assigned_by='self'))
        self.db.flush()
        self.client.put('/api/operator/clock', json={'as_of_date': '2026-10-15'})
        self.hr_login()
        model = AsyncMock(side_effect=AssertionError('HR must not call a model'))
        with patch.object(OpenAIRecommendationModel, 'select', model):
            before = self.summary('Learning')
        self.assertEqual(next(row['employee_count'] for row in before['skill_gaps'] if row['skill_id'] == 'SK_NEGOTIATION'), 6)
        event_before = next(row for row in before['participation'] if row['event_id'] == 'EV_032')
        self.assertEqual(event_before['completed'], 6)
        self.assertEqual(len(before['no_step']), 6)
        self.client.post('/api/demo/login', json={'employee_id': ids[6]})
        enrollment = self.client.post('/api/me/activities/EV_032/enroll', json={'session_date': '2026-10-15'})
        self.assertEqual(enrollment.status_code, 200, enrollment.text)
        record = enrollment.json()['record_id']
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/start').status_code, 200)
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/complete').status_code, 200)
        self.hr_login()
        with patch.object(OpenAIRecommendationModel, 'select', model):
            after = self.summary('Learning')
        self.assertEqual(next(row['employee_count'] for row in after['skill_gaps'] if row['skill_id'] == 'SK_NEGOTIATION'), 5)
        event_after = next(row for row in after['participation'] if row['event_id'] == 'EV_032')
        self.assertEqual(event_after['completed'], 7)
        self.assertEqual(event_after['participants'], 7)
        self.assertEqual(len(after['no_step']), 7)
        model.assert_not_called()

    def test_non_hr_roles_and_expired_sessions_cannot_read_summary(self):
        from datetime import datetime, timedelta, timezone
        from app.models import DemoSession
        from app.main import token_digest
        for role in ('employee', 'manager', 'analyst', 'operator'):
            token = f'TEST_SESSION_{role}'
            self.db.add(DemoSession(token_hash=token_digest(token), actor_role=role, employee_id='E0174', expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
            self.db.flush()
            self.client.cookies.set('cq_session', token)
            self.assertEqual(self.client.get('/api/hr/summary').status_code, 403, role)
            self.assertEqual(self.client.get('/api/hr/summary?department=Sales').status_code, 403, role)
        self.client.cookies.clear()
        self.assertEqual(self.client.get('/api/hr/summary').status_code, 401)
        token = 'TEST_EXPIRED_HR'
        self.db.add(DemoSession(token_hash=token_digest(token), actor_role='hr', employee_id=None, expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
        self.db.flush()
        self.client.cookies.set('cq_session', token)
        self.assertEqual(self.client.get('/api/hr/summary').status_code, 401)

    def test_hr_cannot_write_or_use_employee_identity_to_bypass_scope(self):
        from datetime import datetime, timedelta, timezone
        from app.models import DemoSession
        from app.main import token_digest
        token = 'TEST_HR_WITH_ID'
        self.db.add(DemoSession(token_hash=token_digest(token), actor_role='hr', employee_id='E0174', expires_at=datetime.now(timezone.utc) + timedelta(hours=1)))
        self.db.flush()
        self.client.cookies.set('cq_session', token)
        for path in ('/api/me/profile', '/api/employees/E0174', '/api/me/activities/EV_032', '/api/me/recommendations'):
            self.assertEqual(self.client.get(path).status_code, 403, path)
        self.assertEqual(self.client.post('/api/me/activities/EV_032/enroll', json={}).status_code, 403)
        self.assertEqual(self.client.post('/api/me/participations/anything/complete').status_code, 403)
        self.assertEqual(self.client.put('/api/operator/clock', json={'as_of_date': '2026-10-15'}).status_code, 403)
        self.assertEqual(self.client.post('/api/demo/login', json={'actor_role': 'hr', 'employee_id': 'E0174'}).status_code, 422)

    def test_rare_completion_and_remainder_are_hidden_separately_from_participation(self):
        from datetime import date
        from app.models import ActivityHistory
        ids = self.create_cohort('Statuses', 15)
        for index in range(10):
            self.db.add(ActivityHistory(record_id=f'TEST_STATUS_{index}', employee_id=ids[index], event_id='EV_036', date=date(2026, 9, 1), status='completed' if index < 6 else 'no_show', completion_pct=100 if index < 6 else 0, assigned_by='self'))
        self.db.flush()
        self.hr_login()
        row = next(row for row in self.summary('Statuses')['participation'] if row['event_id'] == 'EV_036')
        self.assertEqual(row['participants'], 10)
        self.assertIsNone(row['completed'])  # 10 - 6 would reveal four non-completers.
        self.assertEqual(set(row), {'event_id', 'title', 'mandatory', 'participants', 'completed'})
        all_row = next(row for row in self.summary()['participation'] if row['event_id'] == 'EV_036')
        self.assertIsNone(all_row['completed'])

    def test_future_outcomes_are_not_counted_and_filtered_names_stay_in_department(self):
        from datetime import date
        from app.models import ActivityHistory
        ids = self.create_cohort('Future', 10, skill_level=5)
        for index in range(5):
            self.db.add(ActivityHistory(record_id=f'TEST_FUTURE_{index}', employee_id=ids[index], event_id='EV_032', date=date(2026, 10, 15), status='completed', completion_pct=100, assigned_by='self'))
        self.db.flush()
        self.hr_login()
        result = self.summary('Future')
        row = next(row for row in result['participation'] if row['event_id'] == 'EV_032')
        self.assertEqual((row['participants'], row['completed']), (0, 0))
        self.assertEqual({p['employee_id'] for p in result['no_step']}, set(ids))
        self.assertTrue(all(p['department'] == 'Future' for p in result['no_step']))

    def test_unknown_filters_do_not_create_personal_drill_down(self):
        self.hr_login()
        base = self.summary()
        response = self.client.get('/api/hr/summary?employee_id=E0174&role=Sales%20Manager&grade=Junior')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['employee_count'], base['employee_count'])
        self.assertEqual(response.json()['skill_gaps'], base['skill_gaps'])
        self.assertEqual(self.client.get('/api/hr/employees/E0174').status_code, 404)
        self.assertEqual(self.client.get('/api/hr/activities/EV_032/participants').status_code, 404)
