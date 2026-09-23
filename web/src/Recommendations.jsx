import React, { useEffect, useState } from 'react';

export default function Recommendations({ profile, api, onOpen, busy }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError('');
    api('/api/me/recommendations', { signal: controller.signal }).then(setResult).catch(e => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => controller.abort();
  }, [profile, api, reload]);

  return <section className="recommendations" aria-labelledby="recommendations-title">
    <h3 id="recommendations-title">Ваш следующий шаг</h3>
    {!result && !error && <p role="status">Подбираем до трёх полезных шагов… Каталог уже можно открыть ниже.</p>}
    {error && <p role="alert">Не удалось загрузить рекомендации: {error} <button className="secondary-button" onClick={() => setReload(value => value + 1)}>Повторить</button></p>}
    {result && <>
      <p className={`recommendation-mode ${result.mode}`} role="status"><strong>{result.label}</strong></p>
      <p>{result.target.kind === 'provisional' ? 'Предварительный ориентир' : result.target.kind === 'goal' ? 'Карьерная цель' : 'Требования текущей роли'}: {result.target.role} / {result.target.grade}</p>
      {result.mode === 'no_step' && <><ul>{Object.entries(result.excluded_reasons).map(([reason, count]) => <li key={reason}>{reason} ({count})</li>)}</ul><a href="#skills">Посмотреть траекторию и требования</a></>}
      <div className="recommendation-list">{result.recommendations.map((card, index) => <article className="activity-detail" key={card.event_id}>
        <h4>{index + 1}. {card.title}</h4>
        <p>{card.format === 'self_paced' ? 'В своём темпе' : card.format === 'offline' ? 'Очно' : 'Онлайн'} · {card.duration_hours} ч · {card.nearest_date}</p>
        <p><strong>Почему этот шаг:</strong> {card.priority_explanation.join(' ')}</p>
        <ul>{card.explanation.map(text => <li key={text}>{text}</li>)}</ul>
        <p>Прогноз «если завершить». Источник: каталог {result.dataset_version}, {card.event_id}.</p>
        <ul>{card.gain_rules.map(rule => <li key={rule.skill_id}>{card.effects.find(effect => effect.skill_id === rule.skill_id)?.name || rule.skill_id}: gain {rule.gain}, max_level {rule.max_level}</li>)}</ul>
        <button className="secondary-button" disabled={busy} onClick={() => onOpen(card.event_id)}>Открыть активность и проверенный прогноз</button>
      </article>)}</div>
    </>}
  </section>;
}
