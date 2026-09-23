"""Result lifecycle, immutable evidence, authorization and unique contribution."""
import unittest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app, get_db
from app.models import ConfirmedRecord, DemoSession, WorkResult


class WorkResultTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(self.connection, join_transaction_mode='create_savepoint')
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.login(employee_id='E0174')

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()
        app.dependency_overrides.clear()

    def login(self, **payload):
        response = self.client.post('/api/demo/login', json=payload)
        self.assertEqual(response.status_code, 200, response.text)

    def payload(self, count=2, prefix='ISSUE22'):
        return {'claimed_actual': 3, 'evidence': [
            {'record_id': f'{prefix}-{i}', 'description': f'CRM: подписанный договор {i}', 'amount': 1}
            for i in range(count)]}

    def create(self, count=2, prefix='ISSUE22'):
        response = self.client.post('/api/work-results', json={'goal_id': 'DEMO-GOAL-CONTRACTS', **self.payload(count, prefix)})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['id']

    def action(self, result, action, payload=None):
        return self.client.post(f'/api/work-results/{result}/{action}', **({'json': payload} if payload is not None else {}))

    def actual(self):
        plans = self.client.get('/api/me/work-goals').json()['plans']
        return next(g['confirmed_actual'] for p in plans for g in p['goals'] if g['id'] == 'DEMO-GOAL-CONTRACTS')

    def test_return_resubmit_confirm_once(self):
        result = self.create()
        self.assertEqual(self.actual(), 0)
        self.assertEqual(self.action(result, 'submit').status_code, 200)
        self.assertEqual(self.action(result, 'edit', self.payload(3)).status_code, 409)
        self.assertEqual(self.action(result, 'confirm').status_code, 403)
        self.login(actor_role='analyst')
        self.assertEqual(self.action(result, 'confirm').status_code, 422)
        self.assertEqual(self.action(result, 'return', {'reason': ' '}).status_code, 422)
        returned = self.action(result, 'return', {'reason': 'Отсутствует третья запись CRM'})
        self.assertEqual(returned.status_code, 200)
        self.login(employee_id='E0174')
        self.assertEqual(self.actual(), 0)
        self.assertEqual(self.action(result, 'edit', self.payload(3)).status_code, 200)
        self.assertEqual(self.action(result, 'submit').status_code, 200)
        self.login(actor_role='analyst')
        confirmed = self.action(result, 'confirm')
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        self.assertEqual(confirmed.json()['id'], result)
        self.assertEqual(self.action(result, 'confirm').json(), confirmed.json())
        history = confirmed.json()['history']
        self.assertEqual([e['action'] for e in history], ['created', 'submit', 'return', 'edit', 'submit', 'confirm'])
        self.assertEqual(len(history[1]['evidence']), 2)
        self.assertEqual(len(history[-1]['evidence']), 3)
        self.assertEqual(history[2]['reason'], 'Отсутствует третья запись CRM')
        self.assertEqual(confirmed.json()['rules']['plan_version'], 1)
        self.assertEqual(self.db.query(ConfirmedRecord).filter_by(result_id=result).count(), 3)
        self.login(employee_id='E0174')
        self.assertEqual(self.actual(), 3)
        self.assertEqual(self.action(result, 'edit', self.payload()).status_code, 409)
        self.assertEqual(self.action(result, 'submit').status_code, 409)
        self.login(employee_id='E0169')
        member = next(m for m in self.client.get('/api/manager/work-goals').json() if m['employee_id'] == 'E0174')
        goal = next(g for p in member['plans'] for g in p['goals'] if g['id'] == 'DEMO-GOAL-CONTRACTS')
        self.assertEqual(goal['confirmed_actual'], 3)

    def test_assignment_and_privacy(self):
        result = self.create()
        self.action(result, 'submit')
        for identity in [{'employee_id': 'E0050'}, {'employee_id': 'E0169'}, {'actor_role': 'hr'}, {'operator': True}, {'actor_role': 'analyst_backup'}]:
            self.login(**identity)
            self.assertEqual(self.client.get(f'/api/work-results/{result}').status_code, 404)
            self.assertEqual(self.action(result, 'confirm').status_code, 404)
        self.assertEqual(self.client.get('/api/work-results').json(), [])
        self.login(actor_role='analyst')
        assigned = self.client.get('/api/work-results').json()
        self.assertIn(result, [r['id'] for r in assigned])
        row = next(r for r in assigned if r['id'] == result)
        self.assertEqual(set(row['author']), {'full_name', 'department'})
        for path in ['/api/me/profile', '/api/employees/E0174', '/api/me/work-goals', '/api/manager/work-goals', '/api/me/activities']:
            self.assertEqual(self.client.get(path).status_code, 403, path)
        # Even a dual-role session cannot review its own result.
        session = self.db.query(DemoSession).filter_by(actor_role='analyst').order_by(DemoSession.created_at.desc()).first()
        session.employee_id = 'E0174'
        self.db.commit()
        self.assertEqual(self.client.get('/api/work-results').json(), [])
        self.assertEqual(self.action(result, 'confirm').status_code, 404)
        self.client.delete('/api/session')
        self.assertEqual(self.client.get('/api/work-results').status_code, 401)

    def test_duplicate_records_cannot_contribute_twice(self):
        first = self.create(3)
        second = self.create(3)
        self.action(first, 'submit')
        self.action(second, 'submit')
        self.login(actor_role='analyst')
        self.assertEqual(self.action(first, 'confirm').status_code, 200)
        self.assertEqual(self.action(second, 'confirm').status_code, 409)
        self.assertEqual(self.db.get(WorkResult, second).status, 'submitted')
        self.assertEqual(self.db.query(ConfirmedRecord).filter_by(result_id=second).count(), 0)
        self.login(employee_id='E0174')
        self.assertEqual(self.actual(), 3)

    def test_validation_and_counted_contract_evidence(self):
        payload = self.payload()
        payload['evidence'][1]['record_id'] = payload['evidence'][0]['record_id'].lower()
        self.assertEqual(self.client.post('/api/work-results', json={'goal_id': 'DEMO-GOAL-CONTRACTS', **payload}).status_code, 422)
        self.assertEqual(self.client.post('/api/work-results', json={'goal_id': 'missing', **self.payload()}).status_code, 422)
        result = self.create(0)
        self.assertEqual(self.action(result, 'submit').status_code, 422)
        payload = self.payload(1)
        payload['evidence'][0]['amount'] = 3
        self.action(result, 'edit', payload)
        self.action(result, 'submit')
        self.login(actor_role='analyst')
        self.assertEqual(self.action(result, 'edit', self.payload(3)).status_code, 403)
        self.assertEqual(self.action(result, 'confirm').status_code, 422)
