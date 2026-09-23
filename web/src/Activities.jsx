import React, { useEffect, useState } from 'react';

export default function Activities({ profile, api, onRefresh }) {
  const [cards, setCards] = useState(null);
  const [selected, setSelected] = useState(null);
  const [sessionDate, setSessionDate] = useState('');
  const [showForecast, setShowForecast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    setCards(null);
    api('/api/me/activities').then(data => {
      if (ignore) return;
      setCards(data);
      setSelected(previous => previous ? data.find(card => card.event_id === previous.event_id) || null : null);
    }).catch(e => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [profile, reload, api]);

  function open(card) {
    setSelected(card); setSessionDate(card.available_sessions[0] || '');
    setShowForecast(false); setError(''); setNotice('');
  }

  async function act(action) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'enroll') {
        await api(`/api/me/activities/${selected.event_id}/enroll`, { method: 'POST', body: JSON.stringify({ session_date: sessionDate }) });
      } else {
        await api(`/api/me/participations/${selected.participation.record_id}/${action}`, { method: 'POST' });
      }
      setShowForecast(false);
      setNotice(action === 'complete' ? 'Активность завершена. Расчётный маршрут обновлён; последняя оценка, рабочий вклад и ОТК не изменились.' : action === 'start' ? 'Активность начата. Навыки пока не изменились.' : 'Вы записаны. Навыки пока не изменились.');
      await onRefresh();
    } catch (e) {
      setError(e.message); setReload(value => value + 1);
    } finally { setBusy(false); }
  }

  const participation = selected?.participation;
  const futureSession = participation && participation.date > profile.as_of_date;
  return <section className="activities" id="activities" aria-labelledby="activities-title">
    <div className="section-heading"><h2 id="activities-title">Развивающие активности</h2></div>
    <p>Выберите шаг из доступного каталога. Прогноз не меняет ваши данные.</p>
    {error && <p role="alert">{error} <button className="secondary-button" onClick={() => { setError(''); setReload(value => value + 1); }}>Обновить список</button></p>}
    {notice && <p role="status" className="activity-notice">{notice}</p>}
    {!cards && !error && <p role="status">Загружаем доступные активности…</p>}
    {cards?.length === 0 && <p>Сейчас нет доступных активностей из каталога для вашей роли, грейда и истории.</p>}
    <div className="activity-list">{cards?.map(card => <button key={card.event_id} className={`activity-choice ${selected?.event_id === card.event_id ? 'selected' : ''}`} aria-pressed={selected?.event_id === card.event_id} disabled={busy} onClick={() => open(card)}><b>{card.title}</b><span>{card.duration_hours} ч · {card.format === 'self_paced' ? 'В своём темпе' : card.format === 'offline' ? 'Очно' : 'Онлайн'}{card.participation ? ` · ${card.participation.status === 'planned' ? 'Запланировано' : 'В процессе'}` : ''}</span></button>)}</div>
    {selected && cards && <article className="activity-detail" aria-label={selected.title}>
      <h3>{selected.title}</h3><p>{selected.description}</p>
      <p>{participation ? `Ваша сессия: ${participation.date}` : selected.format === 'self_paced' ? 'Доступно в своём темпе с текущей даты сценария.' : 'Выберите доступную сессию.'}</p>
      {!participation && <label>Дата {selected.format === 'self_paced' ? 'записи' : 'сессии'}<select value={sessionDate} disabled={busy} onChange={e => setSessionDate(e.target.value)}>{selected.available_sessions.map(day => <option key={day} value={day}>{day}</option>)}</select></label>}
      <p>Источник прироста: каталог {selected.dataset_version}, {selected.event_id}. Завершение не создаёт заявку аналитику и не гарантирует назначения на должность.</p>
      <ul>{selected.develops_skills.map(rule => <li key={rule.skill_id}>{selected.forecast.skills.find(skill => skill.skill_id === rule.skill_id)?.name}: gain {rule.gain}, max_level {rule.max_level}</li>)}</ul>
      <div className="activity-actions"><button className="secondary-button" disabled={busy} onClick={() => setShowForecast(value => !value)}>{showForecast ? 'Отменить прогноз' : 'Что изменится, если завершить'}</button>
        {!participation && <button className="primary-button" disabled={busy || !sessionDate} onClick={() => act('enroll')}>Записаться</button>}
        {participation && <button className="primary-button" disabled={busy || futureSession} onClick={() => act(participation.status === 'planned' ? 'start' : 'complete')}>{participation.status === 'planned' ? 'Начать активность' : 'Завершить активность'}</button>}
      </div>
      {busy && <p role="status">Сохраняем действие…</p>}
      {futureSession && <p>Начало и завершение доступны с {participation.date}. Текущая дата сценария: {profile.as_of_date}.</p>}
      {showForecast && <div className="activity-forecast"><h4>Прогноз «если завершить»</h4><p>Условный учебный прогресс. Он станет фактом только после явного завершения.</p><div className="trajectory-table-wrap"><table className="trajectory-table"><thead><tr><th scope="col">Навык</th><th scope="col">Сейчас</th><th scope="col">Если завершить</th><th scope="col">Останется разрыв</th></tr></thead><tbody>{selected.forecast.skills.map(skill => <tr key={skill.skill_id}><th scope="row">{skill.name}{skill.critical && <small>Критический навык</small>}</th><td>{selected.current.skills.find(current => current.skill_id === skill.skill_id)?.calculated_level ?? 0}</td><td>{skill.calculated_level}</td><td>{skill.required_level == null ? '—' : skill.gap}</td></tr>)}</tbody></table></div><p>{selected.forecast.requirements_met ? 'Расчётные требования будут выполнены. Это не решение о повышении.' : `Останутся разрывы, в том числе критических: ${selected.forecast.critical_gaps.length}.`}</p><h4>Новые доступные активности</h4>{selected.newly_available.length ? <ul>{selected.newly_available.map(event => <li key={event.event_id}>{event.title} · {event.event_id} · сессии: {event.available_sessions.join(', ')}</li>)}</ul> : <p>Этот шаг не открывает новых активностей по предпосылкам каталога.</p>}<p>Доступность будет повторно проверена после завершения: даты сессий могут пройти.</p></div>}
    </article>}
  </section>;
}
