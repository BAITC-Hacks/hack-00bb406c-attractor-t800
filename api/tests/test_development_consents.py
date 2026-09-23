"""Consent isolation through real HTTP endpoints and existing sessions."""
from test_work_goals import WorkGoalTests
from app.models import Employee


class DevelopmentConsentTests(WorkGoalTests):
    endpoint = '/api/manager/employees/E0174/development'

    def grant(self, category, enabled=True, manager='E0169'):
        return self.client.post(f'/api/me/development-consents/{category}', json={'enabled': enabled, 'manager_id': manager})

    def test_independent_grants_and_live_revocation(self):
        settings = self.client.get('/api/me/development-consents').json()
        self.assertEqual(settings['consents'], dict(history=False, career_goal=False, skills=False))
        employee_cookie = self.client.cookies.get('cq_session')
        self.login(employee_id='E0169')
        manager_cookie = self.client.cookies.get('cq_session')
        for category in ('history', 'career_goal', 'skills'):
            self.client.cookies.set('cq_session', employee_cookie)
            self.assertEqual(self.grant(category).status_code, 200)
            self.client.cookies.set('cq_session', manager_cookie)
            response = self.client.get(self.endpoint)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['cache-control'], 'no-store')
            data = response.json()
            self.assertIn(category, data)
            for hidden in {'history', 'career_goal', 'skills'} - {category}:
                self.assertNotIn(hidden, data)
            self.assertFalse({'otk', 'evidence', 'trajectory'} & data.keys())
            self.client.cookies.set('cq_session', employee_cookie)
            self.assertEqual(self.grant(category, False).status_code, 200)
            self.client.cookies.set('cq_session', manager_cookie)
            self.assertNotIn(category, self.client.get(self.endpoint).json())
        self.assertEqual(self.client.get('/api/manager/work-goals').status_code, 200)
        self.assertEqual(self.client.get('/api/work-scores').status_code, 200)
        self.assertEqual(self.client.get('/api/employees/E0174').status_code, 403)

    def test_roles_direct_urls_and_manager_change(self):
        for category in ('history', 'career_goal', 'skills'):
            self.assertEqual(self.grant(category).status_code, 200)
        for account in ({'actor_role': 'hr'}, {'actor_role': 'analyst'}, {'actor_role': 'analyst_backup'}, {'employee_id': 'E0050'}, {'operator': True}):
            self.login(**account)
            self.assertEqual(self.client.get(self.endpoint).status_code, 403)
            if 'employee_id' not in account:
                self.assertEqual(self.client.get('/api/manager/development').status_code, 403)
                self.assertEqual(self.grant('skills').status_code, 403)
        self.login(employee_id='E0169')
        people = self.client.get('/api/manager/development').json()
        expected = {x.employee_id for x in self.db.query(Employee).filter_by(manager_id='E0169')}
        self.assertEqual({x['employee_id'] for x in people}, expected)
        self.assertEqual(self.client.get('/api/manager/employees/E0050/development').status_code, 403)
        employee = self.db.get(Employee, 'E0174')
        employee.manager_id = 'E0050'
        self.db.commit()
        self.assertEqual(self.client.get(self.endpoint).status_code, 403)
        self.login(employee_id='E0050')
        data = self.client.get(self.endpoint).json()
        self.assertEqual(data['consents'], dict(history=False, career_goal=False, skills=False))
        self.login(employee_id='E0174')
        self.assertEqual(self.grant('skills').status_code, 409)
        self.assertEqual(self.grant('skills', manager='E0050').status_code, 200)
        self.assertEqual(self.grant('unknown').status_code, 422)
        self.client.delete('/api/session')
        self.assertEqual(self.client.get(self.endpoint).status_code, 401)
