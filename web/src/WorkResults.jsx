import React, { useEffect, useState } from 'react';

const statuses = { draft: 'Черновик', submitted: 'На проверке', returned: 'Возвращён', confirmed: 'Подтверждён' };
const actions = { created: 'Создан', edit: 'Исправлен', submit: 'Подан', return: 'Возвращён', confirm: 'Подтверждён' };

function DraftForm({ row, goals, busy, save }) {
  const [evidence, setEvidence] = useState(row?.evidence || [{ record_id: '', description: '', amount: 1 }]);
  function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    save(row ? `/${row.id}/edit` : '', { ...(row ? {} : { goal_id: fields.get('goal_id') }), claimed_actual: Number(fields.get('claimed_actual')), evidence });
  }
  return <form onSubmit={submit} className="work-goal-form">
    {!row && <label>Утверждённая цель<select name="goal_id" required>{goals.map(goal => <option value={goal.id} key={goal.id}>{goal.title} · {goal.period}</option>)}</select></label>}
    <label>Заявленный факт<input name="claimed_actual" type="number" step="any" min="0.000001" required defaultValue={row?.claimed_actual || 3}/></label>
    <p>Синтетические доказательства. Для договора укажите уникальный ID и подтверждающую запись CRM; каждый договор имеет объём 1.</p>
    {evidence.map((item, index) => <div className="work-goal-fields" key={index}>
      <label>ID записи<input required pattern="[A-Za-z0-9_-]+" maxLength={100} value={item.record_id} onChange={e => setEvidence(evidence.map((v, i) => i === index ? { ...v, record_id: e.target.value } : v))}/></label>
      <label>Подтверждающая запись<textarea required maxLength={4000} value={item.description} onChange={e => setEvidence(evidence.map((v, i) => i === index ? { ...v, description: e.target.value } : v))}/></label>
      <label>Объём<input type="number" min="0.000001" step="any" required value={item.amount} onChange={e => setEvidence(evidence.map((v, i) => i === index ? { ...v, amount: Number(e.target.value) } : v))}/></label>
      <button type="button" className="link-button" onClick={() => setEvidence(evidence.filter((_, i) => i !== index))}>Удалить запись</button>
    </div>)}
    <button type="button" className="secondary-button" disabled={busy || evidence.length >= 200} onClick={() => setEvidence([...evidence, { record_id: '', description: '', amount: 1 }])}>Добавить запись</button>{' '}
    <button className="primary-button" disabled={busy}>{row ? 'Сохранить исправления' : 'Создать черновик'}</button>
  </form>;
}

export default function WorkResults({ api, actor, onLogout, onChange }) {
  const analyst = ['analyst', 'analyst_backup'].includes(actor.actor_role);
  const [rows, setRows] = useState(null);
  const [goals, setGoals] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let ignore = false;
    Promise.all([api('/api/work-results'), analyst ? Promise.resolve(null) : api('/api/me/work-goals')])
      .then(([results, plans]) => { if (!ignore) { setRows(results); setGoals(plans?.plans.flatMap(p => p.goals) || []); } })
      .catch(e => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [api, analyst, revision]);
  async function save(path, body) {
    setBusy(true); setError('');
    try { await api(`/api/work-results${path}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }); setRevision(v => v + 1); onChange?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className={analyst ? 'operator-page' : 'activities'}>
    <h2>{analyst ? 'Подтверждение результатов' : 'Мои рабочие результаты'}</h2>
    {analyst && <><p>Назначенная очередь · {actor.actor_role === 'analyst' ? 'Основной аналитик' : 'Резервный аналитик'}</p><button className="secondary-button" onClick={onLogout}>Выйти</button></>}
    <p>Заявленный факт входит в итоги только после подтверждения всего пакета.</p>
    {error && <p role="alert" className="error-box">{error}</p>}
    {rows === null && !error && <p role="status">Загружаем результаты…</p>}
    {!analyst && goals.length > 0 && <details className="activity-detail"><summary>Новый рабочий результат</summary><DraftForm goals={goals} busy={busy} save={save}/></details>}
    {!analyst && rows && !goals.length && <p>Для подачи результата нужна утверждённая рабочая цель.</p>}
    {rows?.length === 0 && <p>Результатов пока нет.</p>}
    {rows?.map(row => <article className="activity-detail" key={row.id}>
      <h3>{row.goal.title} · {statuses[row.status]}</h3>
      <p>{row.author.full_name} · {row.author.department} · {row.goal.period}</p>
      <p>Заявлено: {row.claimed_actual} · подтверждено: {row.confirmed_actual} / {row.goal.target} {row.goal.unit}</p>
      <small>ID {row.id} · версия {row.version}</small>
      <ul>{row.evidence.map(e => <li key={e.record_id}><b>{e.record_id}</b> · {e.amount}: {e.description}</li>)}</ul>
      {!analyst && ['draft', 'returned'].includes(row.status) && <><DraftForm key={`${row.id}-${row.version}`} row={row} busy={busy} save={save}/><button className="primary-button" disabled={busy} onClick={() => save(`/${row.id}/submit`)}>Подать сохранённую версию</button></>}
      {analyst && row.status === 'submitted' && <><button className="primary-button" disabled={busy} onClick={() => save(`/${row.id}/confirm`)}>Подтвердить весь пакет</button><form onSubmit={e => { e.preventDefault(); save(`/${row.id}/return`, { reason: new FormData(e.currentTarget).get('reason') }); }}><label>Причина возврата<textarea name="reason" required maxLength={2000} placeholder="Заявлено 3 договора, приложено 2 записи. Добавьте подтверждение третьего договора."/></label><button className="secondary-button" disabled={busy}>Вернуть на доработку</button></form></>}
      {analyst && row.status === 'confirmed' && <form onSubmit={e => { e.preventDefault(); const values = new FormData(e.currentTarget); save(`/${row.id}/records/${encodeURIComponent(values.get('record_id'))}/cancel`, { reason: values.get('reason') }); }}><label>Отменить ошибочную запись<select name="record_id">{row.evidence.map(e => <option key={e.record_id}>{e.record_id}</option>)}</select></label><label>Причина отмены<textarea name="reason" required maxLength={2000}/></label><button className="secondary-button" disabled={busy}>Отменить вклад записи</button></form>}
      <details><summary>История проверки</summary>{row.history.map((event, i) => <div key={i}><p>{actions[event.action] || 'Отмена записи'} {event.record_id} · версия {event.version} · {event.at} · {event.actor}</p>{event.reason && <p><b>{event.reason}</b></p>}<p>Заявлено {event.claimed_actual}; записи: {event.evidence.map(e => e.record_id).join(', ') || 'нет'}</p><ul>{event.evidence.map(e => <li key={e.record_id}>{e.record_id}: {e.description} · {e.amount}</li>)}</ul></div>)}</details>
    </article>)}
  </section>;
}
