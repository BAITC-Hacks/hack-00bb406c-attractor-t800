"""Jury imports exercise the real database with rollback-only HTTP tests."""
import copy
import csv
import io
import json
import unittest
from datetime import date
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app, get_db
from app.models import ActivityHistory, Employee, WorkGoal, WorkPlan
from app.application.imports import History


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(self.connection, join_transaction_mode='create_savepoint')
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.client.post('/api/demo/login', json={'operator': True})
        self.client.put('/api/operator/clock', json={'as_of_date': '2026-10-01'})
        source = self.db.get(Employee, 'E0174')
        from app.application.imports import Person
        self.people = []
        for index in range(3):
            values = {key: copy.deepcopy(getattr(source, key)) for key in Person.model_fields}
            values.update(employee_id=f'JURY_{index}', full_name=f'Jury {index}', hire_date=date(2026, 1, 1),
                          last_review_date=date(2026, 9, 1), skills={'SK_NEGOTIATION': 2},
                          career_goal={'target_role': 'Sales Manager', 'target_grade': 'Middle'})
            self.people.append(values)
        self.history = [dict(record_id=f'JURY_RECORD_{i}', employee_id=p['employee_id'], event_id='EV_032',
                             date='2026-09-15', due_date='', status='completed', completion_pct=100,
                             score='', feedback_rating='', assigned_by='self') for i, p in enumerate(self.people)]

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()
        app.dependency_overrides.clear()

    def payload(self):
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=list(History.model_fields))
        writer.writeheader()
        writer.writerows(self.history)
        return dict(employees_json=json.dumps(dict(meta=dict(dataset='Career Quest', version='1.0', as_of_date='2026-10-01'), employees=self.people), default=str), activity_history_csv=output.getvalue())

    def apply(self):
        payload = self.payload()
        preview = self.client.post('/api/operator/import/preview', json=payload)
        self.assertEqual(preview.status_code, 200, preview.text)
        self.assertEqual(preview.json()['errors'], [], preview.text)
        response = self.client.post('/api/operator/import/apply', json=payload | {'confirmation': preview.json()['confirmation']})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_three_profiles_progress_recommendations_hr_repeat_reset_reload(self):
        from app.application.recommendations import build_candidates
        from app.infrastructure.sql_activities import SqlActivityRepository
        before = self.db.query(Employee).count()
        work_before = (self.db.query(WorkGoal).count(), self.db.query(WorkPlan).count())
        result = self.apply()
        self.assertEqual((result['new_profiles'], result['new_history']), (3, 3))
        for person in self.people:
            profile, candidates, excluded = build_candidates(SqlActivityRepository(self.db), person['employee_id'])
            skill = next(s for s in profile['trajectory']['skills'] if s['skill_id'] == 'SK_NEGOTIATION')
            self.assertEqual(skill['calculated_level'], 3)
            self.assertTrue(candidates or excluded)
            self.client.post('/api/demo/login', json={'employee_id': person['employee_id']})
            self.assertEqual(self.client.get('/api/me/profile').status_code, 200)
            self.assertEqual(self.client.get('/api/employees/E0174').status_code, 403)
        self.client.post('/api/demo/login', json={'actor_role': 'hr'})
        summary = self.client.get('/api/hr/summary').json()
        self.assertEqual(summary['employee_count'], before + 3)
        self.client.post('/api/demo/login', json={'operator': True})
        repeated = self.apply()
        self.assertEqual((repeated['new_profiles'], repeated['new_history'], repeated['unchanged']), (0, 0, 6))
        self.assertEqual(self.client.post('/api/operator/import/reset', json={}).status_code, 409)
        reset = self.client.post('/api/operator/import/reset', json={'confirmed': True})
        self.assertEqual(reset.status_code, 200, reset.text)
        self.assertEqual(reset.json()['deleted_profiles'], 3)
        self.assertEqual(reset.json()['deleted_history'], 3)
        self.assertEqual(self.db.query(Employee).count(), before)
        self.assertEqual((self.db.query(WorkGoal).count(), self.db.query(WorkPlan).count()), work_before)
        self.assertEqual(self.apply()['new_profiles'], 3)

    def test_errors_are_located_and_application_is_atomic(self):
        self.history[-1]['event_id'] = 'EV_UNKNOWN'
        payload = self.payload()
        preview = self.client.post('/api/operator/import/preview', json=payload).json()
        self.assertTrue(any(e['file'] == 'activity_history.csv' and e['field'] == 'event_id' and e['row'] == 4 for e in preview['errors']))
        response = self.client.post('/api/operator/import/apply', json=payload | {'confirmation': 'fake'})
        self.assertEqual(response.status_code, 422)
        self.assertIsNone(self.db.get(Employee, 'JURY_0'))

    def test_confirmation_and_changed_existing_key(self):
        self.assertEqual(self.client.post('/api/operator/import/apply', json=self.payload()).status_code, 409)
        self.apply()
        self.people[0]['skills']['SK_NEGOTIATION'] = 4
        preview = self.client.post('/api/operator/import/preview', json=self.payload()).json()
        self.assertTrue(any(e['field'] == 'employee_id' for e in preview['errors']))
        self.assertEqual(self.db.get(Employee, 'JURY_0').skills['SK_NEGOTIATION'], 2)

    def test_invalid_schema_dates_skills_manager_status_and_duplicate_completion(self):
        variants = [('skills', {'UNKNOWN': 2}), ('skills', {'SK_NEGOTIATION': True}),
                    ('manager_id', 'JURY_0'), ('career_goal', {'target_role': 'Unknown', 'target_grade': 'Junior'}),
                    ('last_review_date', '2027-01-01')]
        original = copy.deepcopy(self.people)
        for key, value in variants:
            self.people = copy.deepcopy(original)
            self.people[0][key] = value
            report = self.client.post('/api/operator/import/preview', json=self.payload()).json()
            self.assertTrue(report['errors'], (key, report))
        self.people = original
        self.apply()
        self.history[0]['record_id'] = 'SECOND_COMPLETION'
        self.assertTrue(self.client.post('/api/operator/import/preview', json=self.payload()).json()['errors'])

    def test_history_for_existing_employee_reset_preserves_official_rows(self):
        existing_count = self.db.query(ActivityHistory).count()
        self.people = []
        self.history = [self.history[0] | dict(employee_id='E0174', event_id='EV_036')]
        result = self.apply()
        self.assertEqual(result['new_profiles'], 0)
        self.assertEqual(self.db.query(ActivityHistory).count(), existing_count + 1)
        self.client.post('/api/operator/import/reset', json={'confirmed': True})
        self.assertEqual(self.db.query(ActivityHistory).count(), existing_count)
        self.assertIsNotNone(self.db.get(Employee, 'E0174'))

    def test_only_operator_can_preview_apply_reset(self):
        for login in ({'employee_id': 'E0174'}, {'actor_role': 'hr'}):
            self.client.post('/api/demo/login', json=login)
            for action in ('preview', 'apply', 'reset'):
                self.assertEqual(self.client.post('/api/operator/import/' + action, json={} if action == 'reset' else self.payload()).status_code, 403)
