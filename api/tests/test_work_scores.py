"""The issue #23 example, cancellations and role isolation through HTTP."""
from test_work_results import WorkResultTests
from app.application.work_scores import seed_scores
from app.models import WorkPlan


class WorkScoreTests(WorkResultTests):
    def setUp(self):
        super().setUp()
        seed_scores(self.db)

    def score(self):
        response = self.client.get('/api/work-scores')
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['personal'][0]

    def test_scores_and_cancellation(self):
        before = self.score()
        self.assertEqual((before['j'], before['otk'], before['annual']), (60, 70, 81.25))
        result = self.create(3, 'SCORES')
        self.action(result, 'submit')
        self.login(employee_id='E0169')
        self.assertEqual((self.score()['j'], self.score()['otk']), (91, 85.5))
        self.login(actor_role='analyst')
        self.assertEqual(self.action(result, 'confirm').status_code, 200)
        self.assertEqual(self.action(result, 'confirm').status_code, 200)
        self.login(employee_id='E0174')
        after = self.score()
        self.assertEqual((after['j'], after['otk'], after['annual']), (120, 100, 88.75))
        self.assertEqual(after['goals'][0]['results'][0]['history'][-1]['action'], 'confirm')
        self.login(employee_id='E0169')
        manager = self.score()
        self.assertEqual((manager['j'], manager['otk']), (100, 90))
        self.assertNotIn('CRM:', str(manager))
        self.assertEqual(self.client.get('/api/work-scores').json()['team'][0]['actual'], 10)
        cancel = f'/api/work-results/{result}/records/SCORES-0/cancel'
        self.assertEqual(self.client.post(cancel, json={'reason': 'Ошибка'}).status_code, 404)
        self.login(actor_role='analyst')
        self.assertEqual(self.client.get('/api/work-scores').status_code, 403)
        self.assertEqual(self.client.post(cancel, json={'reason': ' '}).status_code, 422)
        first = self.client.post(cancel, json={'reason': 'Ошибочный договор'})
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(self.client.post(cancel, json={'reason': 'Повтор'}).json(), first.json())
        self.login(employee_id='E0174')
        self.assertEqual((self.score()['j'], self.score()['otk']), (100, 90))
        self.login(employee_id='E0169')
        self.assertEqual((self.score()['j'], self.score()['otk']), (97, 88.5))
        self.login(actor_role='hr')
        aggregate = self.client.get('/api/work-scores').json()
        self.assertEqual(aggregate['aggregate'][0]['actual'], 9)
        self.assertNotIn('personal', aggregate)
        self.assertNotIn('SCORES-0', str(aggregate))

    def test_no_approved_team_goal_no_personal_effect(self):
        plan = self.db.get(WorkPlan, ('E0169', '2026-Q4'))
        plan.goals = [{**plan.goals[1], 'weight': 100}]
        self.db.commit()
        result = self.create(3, 'NO-TEAM')
        self.action(result, 'submit')
        self.login(employee_id='E0169')
        before = self.score()['otk']
        self.login(actor_role='analyst')
        self.action(result, 'confirm')
        self.login(employee_id='E0169')
        self.assertEqual(self.score()['otk'], before)
        self.assertEqual(self.client.get('/api/work-scores').json()['team'][0]['actual'], 10)
