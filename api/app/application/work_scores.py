"""Explainable demo scores; approved plan snapshots are the rule authority."""
from datetime import datetime, timezone
from fastapi import HTTPException
from app.models import Employee, WorkPlan, WorkGoal, WorkResult, ConfirmedRecord
from app.application.work_results import accessible, snapshot, ANALYSTS

SCORE_RULES = {
    'version': 'demo-otk-v1', 'effective_from': '2026-10-01',
    'description': 'Демонстрационные правила, не действующая методика Halyk',
    'achievement_cap_pct': 150, 'j_weight': .5, 'additional_weight': .5,
    'additional': [
        {'title': 'Качество обслуживания', 'points': 40, 'maximum': 50, 'basis': 'Синтетическая оценка качества Sales'},
        {'title': 'Соблюдение процесса продаж', 'points': 40, 'maximum': 50, 'basis': 'Синтетическая проверка процесса Sales'},
    ],
}


def seed_scores(db):
    plan = db.get(WorkPlan, ('E0174', '2026-Q4'))
    if plan and 'score' not in plan.rules:
        plan.rules = {**plan.rules, 'score': SCORE_RULES, 'previous_quarters': [80, 85, 90]}
    if plan and not db.get(WorkPlan, ('E0169', '2026-Q4')):
        team = {'id': 'DEMO-TEAM-CONTRACTS', 'title': 'Командные договоры', 'period': '2026-Q4',
                'unit': 'договор', 'target': 10, 'weight': 30, 'scope': 'direct_team',
                'baseline_records': [f'DEMO-BASE-{i}' for i in range(1, 8)], 'task_id': 'DEMO-TEAM-CONTRACTS'}
        other = {'id': 'DEMO-MANAGER-OTHER', 'title': 'Другие рабочие цели', 'period': '2026-Q4',
                 'unit': 'план', 'target': 1, 'weight': 70, 'confirmed_actual': 1, 'task_id': 'DEMO-MANAGER-OTHER'}
        db.add(WorkPlan(employee_id='E0169', period=plan.period, version=1,
                       approved_by='E0169', approved_at=plan.approved_at, recorded_at=plan.recorded_at,
                       goals=[team, other], rules={**plan.rules, 'previous_quarters': [], 'team_baselines': {'2026-Q4': [f'DEMO-BASE-{i}' for i in range(1, 8)]}}))
    db.commit()


def team_records(db, manager_id, period, unit):
    return db.query(ConfirmedRecord).join(Employee, Employee.employee_id == ConfirmedRecord.employee_id).join(
        WorkGoal, WorkGoal.id == ConfirmedRecord.goal_id).filter(
        Employee.manager_id == manager_id, WorkGoal.period == period, WorkGoal.unit == unit).all()


def personal(db, employee_id):
    output = []
    for plan in db.query(WorkPlan).filter_by(employee_id=employee_id).order_by(WorkPlan.period):
        rules = plan.rules.get('score')
        goals = []
        for goal in plan.goals:
            team = goal.get('scope') == 'direct_team'
            records = team_records(db, employee_id, plan.period, goal['unit']) if team else db.query(ConfirmedRecord).filter_by(employee_id=employee_id, goal_id=goal['id']).all()
            baseline = goal.get('baseline_records', [])
            actual = goal.get('confirmed_actual', 0) + len(baseline) + sum(r.amount for r in records if r.record_id not in baseline)
            achievement = min(actual / goal['target'] * 100, plan.rules.get('achievement_cap_pct', 150))
            details = []
            if not team:
                for result in db.query(WorkResult).filter_by(employee_id=employee_id, goal_id=goal['id'], status='confirmed'):
                    details.append({'id': result.id, 'rules': result.rules, 'history': result.history, 'evidence': result.evidence})
            goals.append({**goal, 'actual': actual, 'achievement': achievement,
                          'contribution': achievement * goal['weight'] / 100, 'results': details,
                          'baseline_source': 'Синтетические подтверждённые записи демонстрации' if baseline or goal.get('confirmed_actual') else None})
        j = sum(g['contribution'] for g in goals)
        additional = sum(x['points'] for x in rules['additional']) if rules else None
        otk = rules['j_weight'] * j + rules['additional_weight'] * additional if rules else None
        previous = plan.rules.get('previous_quarters', [])
        output.append({'period': plan.period, 'plan_version': plan.version, 'approved_at': plan.approved_at,
                       'rules': rules, 'goals': goals, 'j': j, 'additional': additional, 'otk': otk,
                       'previous_quarters': previous, 'annual': (sum(previous) + otk) / 4 if len(previous) == 3 and otk is not None else None,
                       'preliminary': True, 'formula': 'J = Σ(min(факт / план × 100, 150) × вес / 100); ОТК = 0,5 × J + 0,5 × дополнительные баллы; год = Σ четырёх кварталов / 4'})
    return output


def team_summary(db, manager_id):
    plans = db.query(WorkPlan).filter_by(employee_id=manager_id).all()
    summaries = []
    for p in plans:
        goal = next((g for g in p.goals if g.get('scope') == 'direct_team'), None)
        baseline = p.rules.get('team_baselines', {}).get(p.period, [])
        records = team_records(db, manager_id, p.period, 'договор')
        summaries.append({'period': p.period, 'title': 'Подтверждённые договоры', 'unit': 'договор',
                          'target': goal['target'] if goal else None,
                          'actual': len(baseline) + sum(r.amount for r in records if r.record_id not in baseline),
                          'scope': 'Непосредственные подчинённые; один ID договора учитывается один раз. Влияние на личный ОТК — только при утверждённой командной цели.'})
    return summaries


def cancel(db, actor, result_id, record_id, reason):
    row = accessible(db, actor, result_id, lock=True)
    if actor.actor_role not in ANALYSTS:
        raise HTTPException(403, 'Отмена доступна назначенному аналитику')
    record = db.query(ConfirmedRecord).filter_by(record_id=record_id, result_id=row.id).with_for_update().first()
    if not record:
        raise HTTPException(404, 'Подтверждённая запись не найдена')
    if record.amount:
        old = record.amount
        record.amount = 0
        snapshot(row, 'cancel', actor.actor_role, reason)
        row.history = [*row.history[:-1], {**row.history[-1], 'record_id': record_id, 'previous_amount': old}]
        db.commit()
    return {'record_id': record_id, 'amount': 0, 'history': row.history}
