import React, { useEffect, useState } from 'react';

export default function ClosedComparison({ api, revision = 0 }) {
  const [period, setPeriod] = useState('2026-Q4');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let ignore = false;
    setData(null);
    setError('');
    api(`/api/comparisons?period=${encodeURIComponent(period)}`)
      .then(value => { if (!ignore) setData(value); })
      .catch(e => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [api, period, revision]);
  return <section className="activities">
    <h2>Закрытое сравнение</h2>
    <label>Квартал <input aria-label="Квартал сравнения" value={period} onChange={e => setPeriod(e.target.value)} placeholder="2026-Q4" /></label>
    <p>Сравнение внутри одной роли и грейда. При группе меньше пяти место скрыто. Малые группы и ячейки распределения скрыты целиком.</p>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Загрузка…</p> : <>
      <p>{data.scope}. {data.description}</p>
      {data.groups.length === 0 && <p>Нет оценок для сравнения за выбранный квартал.</p>}
      {data.groups.map(group => <article className="activity-detail" key={`${group.role}-${group.grade}`}>
        <h3>{group.role} · {group.grade} · {group.period}</h3>
        <p>ОТК · {group.unit}</p>
        {group.hidden ? <p>{group.reason}</p> : <>
          {group.rank && <p>Ваше место: <b>{group.rank.from === group.rank.to ? group.rank.from : `${group.rank.from}–${group.rank.to}`}</b> из {group.count}</p>}
          {group.distribution?.map(bin => <p key={bin.range}>{bin.range} баллов: {bin.count} сотрудников</p>)}
        </>}
      </article>)}
    </>}
  </section>;
}
