import React from 'react';

export default function Trajectory({ profile }) {
  const { target, skills, sources, requirements_met, critical_gaps } = profile.trajectory;
  const person = profile.employee;
  return <section id="skills" className="trajectory">
    <div className="section-heading"><h2>Карьерный маршрут</h2></div>
    <p className="route-path"><b>{person.role} · {person.grade}</b>{target.kind !== 'current' && <> → <b>{target.role} · {target.grade}</b></>}</p>
    <p>{target.kind === 'provisional' ? 'Цель не выбрана. Следующий грейд — предварительный ориентир, цель не записана.' : target.kind === 'current' ? 'Цель не выбрана. Следующего грейда нет: показаны требования текущей роли.' : 'Требования выбранной карьерной цели.'}</p>
    <p>{!target.profile_available ? 'Профиль требований не найден.' : requirements_met ? 'Расчётные требования выполнены.' : `Есть разрывы. Критических: ${critical_gaps.length}.`} Соответствие требованиям не означает назначения на должность.</p>
    <p>Последняя оценка: {person.last_review_date}. Расчётный уровень — учебный прогресс на {profile.as_of_date}, а не подтверждение навыка в работе.</p>
    <div className="trajectory-table-wrap"><table className="trajectory-table"><thead><tr><th scope="col">Навык</th><th scope="col">Оценённый</th><th scope="col">Расчётный</th><th scope="col">Требование</th><th scope="col">Разрыв</th></tr></thead><tbody>{skills.map(skill => <tr key={skill.skill_id}><th scope="row">{skill.name}{skill.critical && <small className={skill.gap ? 'gap-critical' : ''}>{skill.gap ? 'Критический разрыв' : 'Критический навык'}</small>}</th><td>{skill.assessed_level} / 5</td><td><b>{skill.calculated_level} / 5</b></td><td>{skill.required_level ?? '—'}</td><td>{skill.required_level == null ? '—' : skill.gap || 'Нет'}</td></tr>)}</tbody></table></div>
    <details className="calculation-details"><summary>Откуда взялись расчётные уровни</summary><p>Исходная оценка + уникальные допустимые завершения после неё. Формула: max(текущий, min(текущий + gain, max_level, 5)). Правила каталога: набор {profile.dataset_version}. Отсутствующий в оценке навык равен 0.</p>{sources.length === 0 && <p>История пуста — показана исходная оценка.</p>}<ul>{sources.map(source => <li key={source.record_id}><b>{source.title}</b> · {source.event_id} · {source.record_id} · {source.date}<p>{source.reason}</p>{source.changes.map(change => <p key={change.skill_id}>{skills.find(s => s.skill_id === change.skill_id)?.name || change.skill_id}: {change.before} → {change.after} (gain {change.gain}, предел {change.max_level})</p>)}</li>)}</ul></details>
  </section>;
}
