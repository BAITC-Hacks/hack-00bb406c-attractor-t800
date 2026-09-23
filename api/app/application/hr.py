"""Aggregate learning needs with fixed department partitions and no drill-down."""
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Protocol

from app.application.recommendations import candidates_for_profile
from app.domain.trajectory import day

MINIMUM_GROUP_SIZE = 5
PARTICIPATION_STATUSES = ('planned', 'in_progress', 'completed', 'no_show', 'dropped', 'declined', 'overdue')


class HrRepository(Protocol):
    def snapshot(self) -> dict: ...


class UnknownDepartment(ValueError):
    pass


def safe_count(count, population):
    # Protect both a small positive cell and its small complementary cell.
    return population >= MINIMUM_GROUP_SIZE and (count == 0 or count >= MINIMUM_GROUP_SIZE) and (population == count or population - count >= MINIMUM_GROUP_SIZE)


def aggregate_count(counts, populations, department):
    if department is not None:
        return counts.get(department, 0) if safe_count(counts.get(department, 0), populations[department]) else None
    # Never reveal a suppressed department via company total minus other departments.
    if any(not safe_count(counts.get(dep, 0), size) for dep, size in populations.items()):
        return None
    return sum(counts.values())


class HrService:
    def __init__(self, repository: HrRepository):
        self.repository = repository

    def summary(self, department=None):
        snapshot = self.repository.snapshot()
        profiles, events = snapshot['profiles'], snapshot['events']
        populations = Counter(p['employee']['department'] for p in profiles)
        if department is not None and department not in populations:
            raise UnknownDepartment('Подразделение отсутствует в активном наборе')
        selected = [p for p in profiles if department is None or p['employee']['department'] == department]
        gaps = defaultdict(Counter)
        participation = defaultdict(lambda: defaultdict(lambda: defaultdict(set)))
        today = day(snapshot['as_of_date'])
        no_step = []
        for profile in profiles:
            person = profile['employee']
            dep, employee_id = person['department'], person['employee_id']
            for skill in profile['trajectory']['skills']:
                if skill['gap'] > 0:
                    gaps[skill['skill_id']][dep] += 1
            for row in profile['history']:
                # Future plans are current plans; future dated outcomes aren't facts yet.
                when = day(row.get('completed_at') or row['date'])
                if row['status'] not in PARTICIPATION_STATUSES or (row['status'] != 'planned' and when > today):
                    continue
                participation[row['event_id']][dep][row['status']].add(employee_id)
                participation[row['event_id']][dep]['participants'].add(employee_id)
            if department is None or dep == department:
                candidates, _ = candidates_for_profile(profile, events)
                if not candidates:
                    # Explicit exception: identity only, never the reason or profile data.
                    no_step.append({key: person[key] for key in ('employee_id', 'full_name', 'department')})
        skill_gaps = [{'skill_id': key, 'name': name, 'employee_count': aggregate_count(gaps[key], populations, department)} for key, name in snapshot['skill_names'].items()]
        skill_gaps.sort(key=lambda row: (row['employee_count'] is None, -(row['employee_count'] or 0), row['name']))
        activity_rows = []
        for event in sorted(events, key=lambda e: e['event_id']):
            totals = {dep: len(participation[event['event_id']][dep]['participants']) for dep in populations}
            completed = {dep: len(participation[event['event_id']][dep]['completed']) for dep in populations}
            participants = aggregate_count(totals, populations, department)
            # Only completion is a public status. Never disclose individual negative
            # statuses; also protect the remainder participants minus completed.
            scoped_departments = populations if department is None else [department]
            completion_safe = participants is not None and all(
                totals[dep] == 0 or safe_count(completed[dep], totals[dep]) for dep in scoped_departments)
            completed_count = sum(completed.values()) if department is None else completed[department]
            activity_rows.append({'event_id': event['event_id'], 'title': event['title'], 'mandatory': event['mandatory'],
                                  'participants': participants, 'completed': completed_count if completion_safe else None})
        # Empty and small scopes do not publish sensitive rows, even zero-valued ones.
        suppressed = len(selected) < MINIMUM_GROUP_SIZE
        return {'as_of_date': snapshot['as_of_date'], 'dataset_version': snapshot['dataset_version'],
                'generated_at': datetime.now(timezone.utc).isoformat(), 'department': department,
                'departments': sorted(populations), 'employee_count': len(selected),
                'privacy': {'minimum_group_size': MINIMUM_GROUP_SIZE, 'aggregates_suppressed': suppressed,
                            'policy': 'Малые группы и ячейки, а также дополняющие их итоги скрыты. Имена доступны только в списке без шага.'},
                'skill_gaps': [] if suppressed else skill_gaps,
                'participation': [] if suppressed else activity_rows,
                'no_step': sorted(no_step, key=lambda person: (person['full_name'], person['employee_id']))}
