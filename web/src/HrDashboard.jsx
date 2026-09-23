import React, { useEffect, useState } from 'react';
import { ArrowRight, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';

function Count({ value }) {
  return value === null ? <span className="hr-withheld" title="Скрыто для защиты малой группы">Скрыто</span> : value;
}

export default function HrDashboard({ api, onLogout }) {
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    setLoading(true); setError('');
    api(`/api/hr/summary${department ? `?department=${encodeURIComponent(department)}` : ''}`, { signal: controller.signal })
      .then(data => {
        if (ignore) return;
        setResult(data); setDepartments(data.departments);
      })
      .catch(e => { if (!ignore && !controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; controller.abort(); };
  }, [api, department, reload]);

  useEffect(() => {
    // Refresh on return and while visible so learning actions in another session
    // become visible without relying on a cached company snapshot.
    const refresh = () => { if (!document.hidden) setReload(value => value + 1); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const current = result && result.department === (department || null) ? result : null;
  const visibleGaps = current?.skill_gaps.filter(row => row.employee_count !== null && row.employee_count > 0) || [];
  const hiddenGapCount = current?.skill_gaps.filter(row => row.employee_count === null).length || 0;
  return <div className="hr-page">
    <header className="topbar hr-topbar"><a className="brand" href="/hr"><span className="brand-icon">cq</span><span>career<span className="brand-light">quest</span></span></a><span className="hr-role"><ShieldCheck size={17}/> HR</span><button className="plain-button" onClick={onLogout}>Выйти <LogOut size={16}/></button></header>
    <main className="hr-content" id="hr-main">
      <div className="hr-heading"><div><h1>Развитие компании</h1><p>Где нужно обучение и кому помочь найти следующий шаг.</p></div><button className="secondary-button hr-refresh" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={16}/> Обновить сводку</button></div>
      <div className="hr-toolbar"><label htmlFor="hr-department">Подразделение<select id="hr-department" value={department} onChange={e => setDepartment(e.target.value)}><option value="">Вся компания</option>{departments.map(name => <option key={name} value={name}>{name}</option>)}</select></label>{current && <p>{current.employee_count} сотрудников · срез {current.as_of_date}<small>Обновлено {new Date(current.generated_at).toLocaleTimeString('ru-RU')} · набор {current.dataset_version}</small></p>}</div>
      <nav className="hr-sections" aria-label="Разделы HR-сводки"><a href="#hr-gaps">Дефициты навыков</a><a href="#hr-participation">Участие в активностях</a><a href="#hr-no-step">Сотрудники без шага</a></nav>
      <p className="hr-privacy"><ShieldCheck size={18}/><span>Группы и чувствительные ячейки меньше пяти скрыты, включая итоги, по которым их можно вычислить. Личные данные развития не раскрываются.</span></p>
      {loading && <p role="status">Обновляем сводку активного набора…</p>}
      {error && <div className="error-box" role="alert">Не удалось обновить сводку: {error}. <button className="secondary-button" onClick={() => setReload(value => value + 1)}>Попробовать снова</button></div>}
      {current && <>
        {current.privacy.aggregates_suppressed && <p className="hr-empty">В этом охвате меньше пяти сотрудников. Дефициты и участие скрыты; минимальный список без шага остаётся доступен.</p>}
        <section className="hr-section" id="hr-gaps" aria-labelledby="hr-gaps-title"><h2 id="hr-gaps-title">Частые дефициты навыков</h2><p>Число сотрудников с расчётным разрывом к своему карьерному ориентиру. Один сотрудник учитывается один раз на навык.</p>
          {visibleGaps.length ? <div className="hr-table-wrap"><table className="hr-table"><caption className="sr-only">Навыки с разрывами, от наиболее частых</caption><thead><tr><th scope="col">Навык</th><th scope="col">Сотрудников с разрывом</th></tr></thead><tbody>{visibleGaps.map(row => <tr key={row.skill_id}><th scope="row">{row.name}</th><td><div className="hr-gap-value"><span className="hr-gap-bar" aria-hidden="true" style={{ width: `${Math.round(row.employee_count / current.employee_count * 100)}%` }}/><span>{row.employee_count}</span></div></td></tr>)}</tbody></table></div> : <p className="hr-empty">{current.privacy.aggregates_suppressed || hiddenGapCount ? 'Нет дефицитов, доступных для показа с учётом защиты малых групп.' : 'В выбранном охвате расчётных дефицитов не найдено.'}</p>}
          {hiddenGapCount > 0 && <p className="hr-note">Часть показателей скрыта для защиты малых групп. Скрытые значения не считаются нулевыми и не участвуют в сортировке.</p>}
        </section>
        <section className="hr-section" id="hr-participation" aria-labelledby="hr-participation-title"><h2 id="hr-participation-title">Участие в активностях</h2><p>Уникальные сотрудники по активности, включая записи в план. Повторные сессии не увеличивают число участников. «Завершили» — хотя бы одно завершение на дату среза.</p>
          {current.participation.length ? <div className="hr-table-wrap"><table className="hr-table"><caption className="sr-only">Участники и завершения по каталогу</caption><thead><tr><th scope="col">Активность</th><th scope="col">Участников</th><th scope="col">Завершили</th></tr></thead><tbody>{current.participation.map(row => <tr key={row.event_id}><th scope="row">{row.title}<small>{row.event_id} · {row.mandatory ? 'Обязательная' : 'Добровольная'}</small></th><td><Count value={row.participants}/></td><td><Count value={row.completed}/></td></tr>)}</tbody></table></div> : <p className="hr-empty">{current.privacy.aggregates_suppressed ? 'Участие скрыто для защиты малой группы.' : 'В активном наборе нет активностей.'}</p>}
          <p className="hr-note">Скрытое значение не равно нулю. Персональные статусы и история участия недоступны.</p>
        </section>
        <section className="hr-section" id="hr-no-step" aria-labelledby="hr-no-step-title"><div className="hr-section-heading"><h2 id="hr-no-step-title">Сотрудники без следующего шага</h2><span>{current.no_step.length}</span></div><p>Нет доступной добровольной активности, сокращающей текущий разрыв. Список рассчитан по каталогу и правилам доступности; сбой AI сам по себе не означает отсутствие шага.</p>
          {current.no_step.length ? <div className="hr-table-wrap"><table className="hr-table"><caption className="sr-only">Минимальный список для помощи с поиском следующего шага</caption><thead><tr><th scope="col">Сотрудник</th><th scope="col">ID</th><th scope="col">Подразделение</th></tr></thead><tbody>{current.no_step.map(person => <tr key={person.employee_id}><th scope="row">{person.full_name}</th><td>{person.employee_id}</td><td>{person.department}</td></tr>)}</tbody></table></div> : <p className="hr-empty">{current.employee_count ? 'Для каждого сотрудника найден хотя бы один допустимый полезный шаг.' : 'В активном наборе пока нет сотрудников.'}</p>}
          <p className="hr-note">Это исключение из обезличивания для помощи сотрудникам. Личные причины, цели, навыки, ОТК и доказательства здесь не раскрываются.</p>
        </section>
      </>}
      <footer className="hr-footer"><span>Демонстрационное приложение · синтетические данные</span><a href="#hr-main">К началу <ArrowRight size={14}/></a></footer>
    </main>
  </div>;
}
