"""HTTP access and atomic plan approval, isolated in rollback-only transactions."""
import unittest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.db import engine
from app.main import app, get_db
from app.models import DemoSession


class WorkGoalTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(self.connection, join_transaction_mode='create_savepoint')
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.login(operator=True)
        self.client.put('/api/operator/clock', json={'as_of_date': '2026-10-01'})
        self.login(employee_id='E0174')

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()
        app.dependency_overrides.clear()

    def login(self, **payload):
        self.assertEqual(self.client.post('/api/demo/login', json=payload).status_code, 200)

    def proposal(self, **changes):
        return self.client.post('/api/me/work-goals', json={
            'period': '2027-Q1', 'title': 'Новые договоры', 'due_date': '2027-01-31',
            'unit': 'договор', 'target': 2, 'task_id': 'DEMO-SALES-1', **changes})

    def approve(self, goals, employee='E0174', period='2027-Q1'):
        return self.client.post(f'/api/manager/employees/{employee}/work-plans/{period}/approve', json={'goals': goals})

    def test_seed_and_atomic_approval(self):
        seeded = self.client.get('/api/me/work-goals').json()['plans'][0]
        self.assertEqual(seeded['period'], '2026-Q4')
        self.assertEqual([g['weight'] for g in seeded['goals']], [40, 60])
        self.assertEqual(seeded['goals'][0]['target'], 2)
        self.assertEqual(seeded['goals'][0]['confirmed_actual'], 0)
        first = self.proposal().json()['id']
        second = self.proposal(title='Качество').json()['id']
        proposals = self.client.get('/api/me/work-goals').json()['proposals']
        self.assertTrue(all(not g['included_in_j'] for g in proposals))
        self.login(employee_id='E0169')
        invalid = [{'goal_id': first, 'weight': 40}]
        self.assertEqual(self.approve(invalid).status_code, 422)
        weights = invalid + [{'goal_id': second, 'weight': 60}]
        approved = self.approve(weights)
        self.assertEqual(approved.status_code, 200, approved.text)
        plan = approved.json()['plans'][-1]
        self.assertEqual(sum(g['weight'] for g in plan['goals']), 100)
        self.assertEqual(plan['approved_by'], 'E0169')
        self.assertTrue(plan['approved_at'] and plan['rules']['effective_from'])
        self.assertEqual(self.approve(weights).status_code, 409)
        self.login(employee_id='E0174')
        self.assertEqual(self.proposal().status_code, 409)
        self.assertEqual(self.client.get('/api/me/work-goals').json()['plans'][-1], plan)

    def test_rejects_unauthorized_roles_and_other_managers(self):
        goal = self.proposal().json()['id']
        weights = [{'goal_id': goal, 'weight': 100}]
        for actor in [{'employee_id': 'E0174'}, {'employee_id': 'E0050'}, {'actor_role': 'hr'}, {'operator': True}]:
            self.login(**actor)
            self.assertEqual(self.approve(weights).status_code, 403)
        # Analyst roles are not yet selectable; exercise the server-side role explicitly.
        session = self.db.query(DemoSession).filter_by(actor_role='operator').order_by(DemoSession.created_at.desc()).first()
        session.actor_role = 'analyst'
        self.db.commit()
        self.assertEqual(self.approve(weights).status_code, 403)
        self.assertEqual(self.client.get('/api/me/work-goals').status_code, 403)
        self.login(employee_id='E0169')
        self.assertEqual(self.approve(weights, employee='E0050').status_code, 403)
        self.client.delete('/api/session')
        self.assertEqual(self.approve(weights).status_code, 401)

    def test_validation_and_period_deadline(self):
        for changes in [{'target': 0}, {'target': -1}, {'title': ' '}, {'task_id': 'REAL-1'}, {'due_date': '2027-04-01'}, {'period': '2027-Q5'}]:
            self.assertEqual(self.proposal(**changes).status_code, 422)
        self.assertEqual(self.proposal(period='2026-Q4', due_date='2026-10-31').status_code, 409)
        goal = self.proposal().json()['id']
        self.login(employee_id='E0169')
        self.assertEqual(self.approve([{'goal_id': 'missing', 'weight': 100}]).status_code, 422)
        self.assertEqual(self.approve([{'goal_id': goal, 'weight': 50}] * 2).status_code, 422)
        self.login(operator=True)
        self.client.put('/api/operator/clock', json={'as_of_date': '2027-01-01'})
        self.login(employee_id='E0169')
        self.assertEqual(self.approve([{'goal_id': goal, 'weight': 100}]).status_code, 409)
