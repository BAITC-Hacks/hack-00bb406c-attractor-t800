import csv
import json
import os
from pathlib import Path
import unittest
from app.domain.trajectory import build_trajectory, calculate_levels, target_profile

DATA = Path(os.environ.get('DATASET_PATH', Path(__file__).resolve().parents[2] / 'data' / 'official'))

class TrajectoryTests(unittest.TestCase):
    def row(self, **kwargs):
        return dict(record_id='R1', event_id='EV_010', title='Course', date='2026-09-20', status='completed', mandatory=False, format='online', develops_skills=[dict(skill_id='S', gain=1, max_level=4)], **kwargs)

    def test_cap_dedup_and_no_mutation(self):
        assessed = {'S': 5}
        row = self.row()
        levels, sources = calculate_levels(assessed, '2026-09-01', [row, row], '2026-10-01')
        self.assertEqual(levels, {'S': 5})
        self.assertEqual(len(sources), 1)
        self.assertEqual(assessed, {'S': 5})

    def test_uncertain_incomplete_future_and_same_day(self):
        for changes in [dict(format='self_paced', date='2026-09-01'), dict(status='in_progress'), dict(date='2026-11-01'), dict(date='2026-09-01')]:
            levels, _ = calculate_levels({'S': 1}, '2026-09-01', [{**self.row(), **changes}], '2026-10-01')
            self.assertEqual(levels['S'], 1)

    def test_repeatable_club_only(self):
        for event, expected in [('EV_010', 2), ('EV_036', 3)]:
            rows = [{**self.row(), 'event_id': event}, {**self.row(), 'event_id': event, 'record_id': 'R2'}]
            self.assertEqual(calculate_levels({'S': 1}, '2026-09-01', rows, '2026-10-01')[0]['S'], expected)

    def test_actual_completion_date_overrides_enrollment(self):
        row = {**self.row(), 'format': 'self_paced', 'date': '2026-08-01', 'completed_at': '2026-09-25T10:00:00Z'}
        self.assertEqual(calculate_levels({}, '2026-09-01', [row], '2026-10-01')[0]['S'], 1)

    def test_goal_and_fallback(self):
        employee = dict(role='Sales Manager', grade='Junior', career_goal=None)
        target, _ = target_profile(employee, [])
        self.assertEqual((target['grade'], target['kind']), ('Middle', 'provisional'))
        self.assertIsNone(employee['career_goal'])
        self.assertEqual(target_profile({**employee, 'grade': 'Lead'}, [])[0]['kind'], 'current')
        goal = dict(target_role='Backend Engineer', target_grade='Senior')
        self.assertEqual(target_profile({**employee, 'career_goal': goal}, [])[0]['role'], 'Backend Engineer')

    def test_official_profiles(self):
        employees = json.loads((DATA / 'employees.json').read_text())['employees']
        catalog = json.loads((DATA / 'events.json').read_text())['events']
        events = {e['event_id']: e for e in catalog}
        skills = json.loads((DATA / 'skills.json').read_text())
        with (DATA / 'activity_history.csv').open() as stream:
            history = list(csv.DictReader(stream))
        for employee in employees:
            rows = [{**events[r['event_id']], **r} for r in history if r['employee_id'] == employee['employee_id']]
            result = build_trajectory(employee, employee['skills'], skills['role_profiles'], rows, {}, '2026-10-01')
            self.assertTrue(result['target']['profile_available'])
            self.assertTrue(all(0 <= s['calculated_level'] <= 5 for s in result['skills']))
            if employee['employee_id'] == 'E0050':
                self.assertEqual(next(s for s in result['skills'] if s['skill_id'] == 'SK_OBSERVABILITY')['calculated_level'], 5)
                source = next(s for s in result['sources'] if s['event_id'] == 'EV_006')
                change = next(c for c in source['changes'] if c['skill_id'] == 'SK_OBSERVABILITY')
                self.assertEqual((change['before'], change['after'], change['max_level']), (5, 5, 4))
            if employee['employee_id'] == 'E0174':
                self.assertEqual(result['target']['grade'], 'Middle')
                self.assertIn('SK_NEGOTIATION', result['critical_gaps'])
                self.assertEqual(next(s for s in result['skills'] if s['skill_id'] == 'SK_NEGOTIATION')['calculated_level'], 2)
                expected = next(p for p in skills['role_profiles'] if p['role'] == 'Sales Manager' and p['grade'] == 'Middle')
                self.assertEqual({s['skill_id'] for s in result['skills'] if s['required_level'] is not None}, set(expected['required_skills']))

if __name__ == '__main__':
    unittest.main()
