"""Availability and hypothetical learning changes, independent of persistence."""
from copy import deepcopy
from app.domain.trajectory import REPEATABLE_EVENTS, apply_gain, day


class ActivityConflict(ValueError):
    pass


def validate_audience(event, profile):
    person = profile['employee']
    levels = {s['skill_id']: s['calculated_level'] for s in profile['trajectory']['skills']}
    if event['mandatory']:
        raise ActivityConflict('Обязательные активности назначаются отдельно')
    if person['role'] not in event['target_roles'] or person['grade'] not in event['target_grades']:
        raise ActivityConflict('Активность недоступна для текущей роли или грейда')
    if any(levels.get(skill, 0) < level for skill, level in event['prerequisites'].items()):
        raise ActivityConflict('Не выполнены предпосылки активности')


def available_sessions(event, profile):
    history = [h for h in profile['history'] if h['event_id'] == event['event_id']]
    if event['event_id'] not in REPEATABLE_EVENTS and any(h['status'] == 'completed' for h in history):
        return []
    if event['format'] == 'self_paced':
        return [str(profile['as_of_date'])]
    used = {str(h['date']) for h in history if h['status'] == 'completed'}
    return [d for d in event['upcoming_sessions'] if day(d) >= day(profile['as_of_date']) and d not in used]


def forecast(event, trajectory):
    result = deepcopy(trajectory)
    by_id = {s['skill_id']: s for s in result['skills']}
    for rule in event['develops_skills']:
        skill = by_id.get(rule['skill_id'])
        if skill is None:
            skill = dict(skill_id=rule['skill_id'], name=rule['skill_id'], assessed_level=0, calculated_level=0, required_level=None, critical=False, gap=0)
            result['skills'].append(skill)
        before = skill['calculated_level']
        skill['calculated_level'] = apply_gain(before, rule['gain'], rule['max_level'])
        skill['gap'] = max(0, (skill['required_level'] or 0) - skill['calculated_level'])
    result['critical_gaps'] = [s['skill_id'] for s in result['skills'] if s['critical'] and s['gap']]
    result['requirements_met'] = all(s['gap'] == 0 for s in result['skills']) if result['target']['profile_available'] else None
    return result
