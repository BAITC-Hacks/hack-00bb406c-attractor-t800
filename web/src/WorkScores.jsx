import React, { useEffect, useState } from 'react';

const number = value => value == null ? 'Нет оценки' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);

export default function WorkScores({ api, revision = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let ignore = false;
    function refresh() {
      api('/api/work-scores').then(value => { if (!ignore) { setData(value); setError(''); } }).catch(e => { if (!ignore) setError(e.message); });
    }
    refresh();
    window.addEventListener('focus', refresh);
    return () => { ignore = true; window.removeEventListener('focus', refresh); };
  }, [api, revision, reload]);
  return <section className="activities">
    <h2>Рабочие показатели и ОТК</h2>
    <p>Демонстрационные правила, не действующая методика Halyk. Все оценки предварительные.</p>
    <button className="secondary-button" onClick={() => setReload(v => v + 1)}>Обновить показатели</button>
    {error && <p role="alert">{error}</p>}
    {data?.personal?.length === 0 && <p>Нет утверждённого плана для расчёта.</p>}
    {data?.personal?.map(p => <article className="activity-detail" key={p.period}>
      <h3>{p.period} · предварительная оценка</h3>
      <p>J: <b>{number(p.j)}%</b> · ОТК: <b>{number(p.otk)}</b> · Годовой прогноз: <b>{number(p.annual)}</b></p>
      <details><summary>Как рассчитано</summary>
        <p>{p.formula}</p><p>План v{p.plan_version} · утверждён {p.approved_at} · правила {p.rules?.version || 'Дополнительные показатели не настроены'} · действуют с {p.rules?.effective_from}</p>
        {p.goals.map(g => <div key={g.id}><h4>{g.title}</h4><p>{number(g.actual)} / {number(g.target)} {g.unit} · выполнение {number(g.achievement)}% · вес {g.weight}% · вклад в J {number(g.contribution)} · {g.task_id}</p>
          {g.baseline_source && <p>{g.baseline_source}: {g.baseline_records?.join(', ') || number(g.confirmed_actual)}</p>}
          {g.results.map(r => <details key={r.id}><summary>Результат {r.id} · решение и доказательства</summary><p>Версия плана при подтверждении: {r.rules?.plan_version}</p>{r.evidence.map(e => <p key={e.record_id}>{e.record_id}: {e.description}</p>)}{r.history.map((h, i) => <p key={i}>{h.at} · {h.actor} · {h.action} · {h.record_id} {h.reason}</p>)}</details>)}
        </div>)}
        {p.rules?.additional.map(a => <p key={a.title}>{a.title}: {a.points}/{a.maximum} · {a.basis}</p>)}
        <p>Предыдущие кварталы: {p.previous_quarters.join(', ') || 'Нет полного набора оценок'}; текущий: {number(p.otk)}. Годовой итог требует четыре квартала.</p>
      </details>
    </article>)}
    {data?.team?.map((t, i) => <article className="activity-detail" key={i}><h3>Команда · {t.period} · {t.title}</h3><p>{number(t.actual)} / {number(t.target)} {t.unit}</p><p>{t.scope}</p></article>)}
    {data?.aggregate && <><p>{data.description}</p>{data.aggregate.length === 0 && <p>Подтверждённых договоров пока нет.</p>}{data.aggregate.map(a => <p key={a.period}>{a.period}: {a.actual == null ? 'Скрыто: малая группа' : number(a.actual)} {a.unit}</p>)}</>}
  </section>;
}
