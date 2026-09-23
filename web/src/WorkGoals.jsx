import React, { useEffect, useState } from 'react';

function Plan({ plan }) {
  return <article className="activity-detail"><h3>Утверждённый план · {plan.period}</h3>
    <p>Версия {plan.version} · согласовано {plan.approved_at.slice(0, 10)} · руководитель {plan.approved_by}</p>
    <div className="trajectory-table-wrap"><table className="trajectory-table"><thead><tr><th>Цель и срок</th><th>План</th><th>Подтверждённый факт</th><th>Вес J</th></tr></thead><tbody>{plan.goals.map(goal => <tr key={goal.id}><th>{goal.title}<small>{goal.due_date} · {goal.task_id} · утверждена</small></th><td>{goal.target} {goal.unit}</td><td>{goal.confirmed_actual} {goal.unit}</td><td>{goal.weight}%</td></tr>)}</tbody></table></div>
    <p>{plan.rules.description}. Правила {plan.rules.version}, действуют с {plan.rules.effective_from}. Учебные активности не меняют рабочий факт.</p>
  </article>;
}

function Proposals({ data, manager, busy, approve }) {
  const [weights, setWeights] = useState({});
  const periods = [...new Set(data.proposals.map(goal => goal.period))];
  return periods.map(period => {
    const goals = data.proposals.filter(goal => goal.period === period);
    const total = goals.reduce((sum, goal) => sum + Number(weights[goal.id] || 0), 0);
    const locked = data.plans.some(plan => plan.period === period) || `${period.slice(0, 4)}-${String((Number(period.at(-1)) - 1) * 3 + 1).padStart(2, '0')}-01` <= data.as_of_date;
    return <article className="activity-detail" key={period}><h3>На согласовании · {period}</h3><p>Эти цели пока не участвуют в J.</p>{goals.map(goal => <div className="work-goal-proposal" key={goal.id}><div><b>{goal.title}</b><p>План: {goal.target} {goal.unit} · срок {goal.due_date} · {goal.task_id}</p><small>Предложена {goal.proposed_at.slice(0, 10)}</small></div>{manager && !locked && <label>Вес J, %<input type="number" min="1" max="100" step="1" value={weights[goal.id] || ''} onChange={e => setWeights({ ...weights, [goal.id]: e.target.value })}/></label>}</div>)}
      {manager && (locked ? <p>Согласование закрыто: период начался или план уже утверждён.</p> : <><p>Сумма весов: {total}% из 100%</p><button className="primary-button" disabled={busy || total !== 100 || goals.some(goal => !Number.isInteger(Number(weights[goal.id])) || Number(weights[goal.id]) <= 0)} onClick={() => approve(data.employee_id, period, goals.map(goal => ({ goal_id: goal.id, weight: Number(weights[goal.id]) })))}>Утвердить план на квартал</button></>)}
    </article>;
  });
}

export default function WorkGoals({ api, actor }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let ignore = false;
    Promise.all([api('/api/me/work-goals'), actor.actor_role === 'manager' ? api('/api/manager/work-goals') : Promise.resolve([])])
      .then(([own, team]) => { if (!ignore) setData({ own, team }); })
      .catch(e => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [api, actor.actor_role, revision]);
  async function save(path, body, message) {
    setBusy(true); setError(''); setNotice('');
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); setRevision(value => value + 1); setNotice(message); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function propose(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    save('/api/me/work-goals', { ...fields, target: Number(fields.target) }, 'Цель отправлена на согласование руководителю.');
  }
  const approve = (employee, period, goals) => save(`/api/manager/employees/${employee}/work-plans/${period}/approve`, { goals }, 'План утверждён. Сумма весов — 100%.');
  return <section className="activities" id="work-goals"><div className="section-heading"><h2>Рабочие цели</h2></div>
    <p>Предложите измеримый результат на квартал. Руководитель утверждает план и веса до начала периода. Задачи с префиксом DEMO — демонстрационные.</p>
    {error && <p role="alert" className="error-box">{error}</p>}{notice && <p role="status" className="activity-notice">{notice}</p>}
    {!data && !error && <p role="status">Загружаем планы…</p>}
    {data && <><p>Дата сценария: {data.own.as_of_date}</p>{data.own.plans.map(plan => <Plan key={plan.period} plan={plan}/>)}<Proposals data={data.own}/>
      {!data.own.plans.length && !data.own.proposals.length && <p>У вас пока нет рабочих целей.</p>}
      <form className="activity-detail work-goal-form" onSubmit={propose}><h3>Предложить цель</h3><div className="work-goal-fields">
        <label>Название<input name="title" required maxLength="200" placeholder="Заключить 2 договора"/></label>
        <label>Квартал<input name="period" required pattern="20[0-9]{2}-Q[1-4]" placeholder="2027-Q1" title="Например, 2027-Q1"/></label>
        <label>Срок<input name="due_date" type="date" required/></label>
        <label>Единица<input name="unit" required maxLength="50" placeholder="договор"/></label>
        <label>План<input name="target" type="number" min="0.000001" step="any" required/></label>
        <label>Демонстрационная задача<input name="task_id" required pattern="DEMO-[A-Z0-9-]{1,60}" placeholder="DEMO-SALES-1"/></label>
      </div><button className="primary-button" disabled={busy}>Отправить на согласование</button></form>
      {actor.actor_role === 'manager' && <><h3>Планы прямых подчинённых</h3>{!data.team.length && <p>Прямых подчинённых нет.</p>}{data.team.map(member => <section key={member.employee_id}><h4>{member.full_name} · {member.employee_id}</h4>{member.plans.map(plan => <Plan key={plan.period} plan={plan}/>)}<Proposals data={member} manager busy={busy} approve={approve}/>{!member.plans.length && !member.proposals.length && <p>Цели ещё не предложены.</p>}</section>)}</>}
    </>}
  </section>;
}
