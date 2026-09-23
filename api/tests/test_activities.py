"""HTTP contracts on a rollback-only PostgreSQL transaction; official fixtures stay intact."""
import unittest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app, get_db


class ActivityApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(self.connection, join_transaction_mode='create_savepoint')
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.client.post('/api/demo/login', json={'employee_id': 'E0174'})

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()
        app.dependency_overrides.clear()

    def profile(self):
        response = self.client.get('/api/me/profile')
        self.assertEqual(response.status_code, 200)
        return response.json()

    def clock(self, day):
        self.client.post('/api/demo/login', json={'operator': True})
        self.client.put('/api/operator/clock', json={'as_of_date': day})
        self.client.post('/api/demo/login', json={'employee_id': 'E0174'})

    def test_forecast_is_read_only_and_completion_is_once(self):
        before = self.profile()
        forecast = self.client.get('/api/me/activities/EV_032').json()
        self.assertEqual(forecast['available_sessions'][0], '2026-10-15')
        negotiation = next(s for s in forecast['forecast']['skills'] if s['skill_id'] == 'SK_NEGOTIATION')
        self.assertEqual(negotiation['calculated_level'], 3)
        self.assertEqual(self.profile(), before)
        response = self.client.post('/api/me/activities/EV_032/enroll', json={'session_date': '2026-10-15'})
        self.assertEqual(response.status_code, 200, response.text)
        record = response.json()['record_id']
        self.assertEqual(self.profile()['trajectory']['skills'], before['trajectory']['skills'])
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/complete').status_code, 409)
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/start').status_code, 409)
        self.clock('2026-10-15')
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/start').status_code, 200)
        self.assertEqual(next(s for s in self.profile()['trajectory']['skills'] if s['skill_id'] == 'SK_NEGOTIATION')['calculated_level'], 2)
        done = self.client.post(f'/api/me/participations/{record}/complete')
        self.assertEqual(done.status_code, 200, done.text)
        after = self.profile()
        skill = next(s for s in after['trajectory']['skills'] if s['skill_id'] == 'SK_NEGOTIATION')
        self.assertEqual((skill['assessed_level'], skill['calculated_level']), (2, 3))
        self.assertTrue(after['trajectory']['critical_gaps'])
        self.assertEqual(after['employee'], before['employee'])
        self.assertTrue(done.json()['completed_at'].startswith('2026-10-15'))
        self.assertTrue(done.json()['recorded_at'])
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/complete').json(), done.json())
        self.assertEqual(self.profile(), after)
        self.assertEqual(self.client.post('/api/me/activities/EV_032/enroll', json={'session_date': '2026-11-05'}).status_code, 409)

    def test_revalidates_access_sessions_and_current_audience(self):
        self.assertEqual(self.client.post('/api/me/activities/EV_032/enroll', json={'session_date': '2026-10-02'}).status_code, 409)
        self.assertEqual(self.client.post('/api/me/activities/EV_001/enroll', json={}).status_code, 409)
        record = self.client.post('/api/me/activities/EV_032/enroll', json={'session_date': '2026-10-15'}).json()['record_id']
        self.assertEqual(self.client.post('/api/me/activities/EV_032/enroll', json={'session_date': '2026-11-05'}).status_code, 409)
        self.client.post('/api/demo/login', json={'employee_id': 'E0050'})
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/start').status_code, 404)
        self.assertEqual(self.client.get('/api/me/activities/EV_032').status_code, 409)
        self.client.post('/api/demo/login', json={'operator': True})
        self.assertEqual(self.client.get('/api/me/activities').status_code, 403)
        self.client.delete('/api/session')
        self.assertEqual(self.client.get('/api/me/activities').status_code, 401)

    def test_repeatable_event_requires_another_session(self):
        record = self.client.post('/api/me/activities/EV_036/enroll', json={'session_date': '2026-10-08'}).json()['record_id']
        self.clock('2026-10-08')
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/start').status_code, 200)
        self.assertEqual(self.client.post(f'/api/me/participations/{record}/complete').status_code, 200)
        self.assertEqual(self.client.post('/api/me/activities/EV_036/enroll', json={'session_date': '2026-10-08'}).status_code, 409)
        self.assertEqual(self.client.post('/api/me/activities/EV_036/enroll', json={'session_date': '2026-10-22'}).status_code, 200)
