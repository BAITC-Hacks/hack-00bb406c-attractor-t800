"""HTTP privacy boundary with real four/five-person comparison cohorts."""
import copy
import unittest
from test_work_results import WorkResultTests
from app.models import Employee, WorkPlan
from app.application.work_scores import seed_scores


class ComparisonTests(unittest.TestCase):
    setUp = WorkResultTests.setUp
    tearDown = WorkResultTests.tearDown
    login = WorkResultTests.login

    def cohort(self, count):
        seed_scores(self.db)
        source = self.db.get(Employee, 'E0174')
        plan = self.db.get(WorkPlan, ('E0174', '2026-Q4'))
        for i in range(count):
            fields = {c.name: copy.deepcopy(getattr(source, c.name)) for c in Employee.__table__.columns}
            fields.update(employee_id=f'PRIVATE-{i}', full_name=f'Secret colleague {i}', role='Comparison test', grade='G1', manager_id='E0169')
            self.db.add(Employee(**fields))
        self.db.flush()
        for i in range(count):
            fields = {c.name: copy.deepcopy(getattr(plan, c.name)) for c in WorkPlan.__table__.columns}
            fields['employee_id'] = f'PRIVATE-{i}'
            self.db.add(WorkPlan(**fields))
        self.db.commit()

    def groups(self):
        response = self.client.get('/api/comparisons?period=2026-Q4')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn('Secret colleague', response.text)
        self.assertNotIn('PRIVATE-', response.text)
        return [g for g in response.json()['groups'] if g['role'] == 'Comparison test']

    def test_four_hidden_five_rank_and_no_foreign_row(self):
        self.cohort(5)
        self.login(employee_id='PRIVATE-0')
        group = self.groups()[0]
        self.assertEqual(group['rank'], {'from': 1, 'to': 5})
        self.assertNotIn('distribution', group)
        self.assertEqual(set(group), {'role', 'grade', 'period', 'metric', 'unit', 'hidden', 'reason', 'count', 'rank'})
        for query in ['employee_id=PRIVATE-1', 'department=Sales', 'grade=G1', 'metric=contribution', 'unit=договор']:
            self.assertEqual(self.client.get('/api/comparisons?period=2026-Q4&' + query).status_code, 422)
        self.assertEqual(self.client.get('/api/comparisons/PRIVATE-1?period=2026-Q4').status_code, 404)
        self.assertEqual(self.client.get('/api/employees/PRIVATE-1').status_code, 403)
        self.assertNotIn('PRIVATE-1', self.client.get('/api/work-scores').text)
        self.db.delete(self.db.get(WorkPlan, ('PRIVATE-4', '2026-Q4')))
        self.db.commit()
        group = self.groups()[0]
        self.assertTrue(group['hidden'])
        self.assertNotIn('rank', group)
        self.assertNotIn('count', group)

    def test_manager_hr_small_cells_and_scope(self):
        self.cohort(5)
        for identity in ({'employee_id': 'E0169'}, {'actor_role': 'hr'}):
            self.login(**identity)
            group = self.groups()[0]
            self.assertFalse(group['hidden'])
            self.assertNotIn('rank', group)
            self.assertEqual([b['count'] for b in group['distribution']], [5, 0, 0])
        plan = self.db.get(WorkPlan, ('PRIVATE-4', '2026-Q4'))
        rules = copy.deepcopy(plan.rules)
        rules['score']['additional'][0]['points'] = 120
        plan.rules = rules
        self.db.commit()
        for identity in ({'employee_id': 'E0169'}, {'actor_role': 'hr'}):
            self.login(**identity)
            group = self.groups()[0]
            self.assertTrue(group['hidden'])
            self.assertNotIn('distribution', group)
            self.assertNotIn('count', group)
        self.db.get(Employee, 'PRIVATE-4').manager_id = None
        self.db.commit()
        self.login(employee_id='E0169')
        self.assertTrue(self.groups()[0]['hidden'])

    def test_comparability_period_and_access(self):
        self.cohort(5)
        self.db.get(Employee, 'PRIVATE-4').grade = 'G2'
        self.db.commit()
        self.login(employee_id='PRIVATE-0')
        self.assertTrue(self.groups()[0]['hidden'])
        self.assertEqual(self.client.get('/api/comparisons?period=2026-Q3').json()['groups'], [])
        self.assertEqual(self.client.get('/api/comparisons?period=bad').status_code, 422)
        for identity in ({'actor_role': 'analyst'}, {'operator': True}):
            self.login(**identity)
            self.assertEqual(self.client.get('/api/comparisons?period=2026-Q4').status_code, 403)
        self.client.delete('/api/session')
        self.assertEqual(self.client.get('/api/comparisons?period=2026-Q4').status_code, 401)
