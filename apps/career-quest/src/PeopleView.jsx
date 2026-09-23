import { useMemo, useState } from 'react';
import './people.css';

const categoryLabels = { backend: 'Backend', data: 'Данные и AI', product: 'Продукт', communication: 'Коммуникация', leadership: 'Лидерство' };
const formatDate = (value) => value && !Number.isNaN(Date.parse(value))
  ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(value))
  : 'Ещё нет';
const scores = (employee) => (employee.history || []).map((item) => item.score).filter(Number.isFinite);
const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const employeeAverage = (employee) => average(scores(employee));
const latestDate = (employee) => (employee.history || []).map((item) => item.submittedAt).filter(Boolean).sort().at(-1);

export function PeopleView({ state, role, onOpenEmployee, onExport }) {
  const [department, setDepartment] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const isHR = role === 'hr';
  const scoped = useMemo(() => (state.employees || []).filter((employee) => isHR || employee.managerId === 'aigerim'), [state.employees, isHR]);
  const departments = [...new Set(scoped.map((employee) => employee.department))].filter(Boolean).sort();
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('ru-RU');
    return scoped.filter((employee) => (!isHR || department === 'all' || employee.department === department)
      && [employee.name, employee.department, employee.role, employee.grade, ...(employee.skills || []).map((skill) => skill.title)].join(' ').toLocaleLowerCase('ru-RU').includes(search))
      .sort((a, b) => sort === 'score' ? (employeeAverage(b) ?? -1) - (employeeAverage(a) ?? -1) || a.name.localeCompare(b.name, 'ru')
        : sort === 'skills' ? (b.skills || []).length - (a.skills || []).length || a.name.localeCompare(b.name, 'ru')
          : a.name.localeCompare(b.name, 'ru'));
  }, [scoped, isHR, department, query, sort]);
  const skillCount = filtered.reduce((sum, employee) => sum + (employee.skills || []).length, 0);
  const allScores = filtered.flatMap(scores);
  const mean = average(allScores);
  const activeCount = filtered.filter((employee) => (employee.history || []).some((result) => (result.month || result.submittedAt?.slice(0, 7)) === state.month)).length;
  const categories = [...new Set(filtered.flatMap((employee) => (employee.skills || []).map((skill) => skill.category)))].filter(Boolean)
    .map((name) => ({ name, count: filtered.filter((employee) => (employee.skills || []).some((skill) => skill.category === name)).length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'));
  const clearFilters = () => { setQuery(''); setDepartment('all'); setSort('name'); };

  return <section className="people-page" aria-label={isHR ? 'Обзор сотрудников компании' : 'Обзор своей команды'}>
    <header className="people-heading">
      <div><p className="people-eyebrow">{isHR ? 'HR · Развитие талантов' : 'Руководитель · Моя команда'}</p>
        <h1>{isHR ? 'Карта навыков компании' : 'Команда растёт вместе'}</h1>
        <p className="people-intro">Подтверждённые навыки, результаты и следующий шаг каждого сотрудника.</p></div>
      <span className="people-demo">Демо · {isHR ? 'Все сотрудники' : 'Команда Айгерим'}</span>
    </header>

    <div className="people-toolbar">
      <label className="people-search"><span>Поиск сотрудников и навыков</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, роль или навык" /></label>
      {isHR && <label><span>Подразделение</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">Все подразделения</option>{departments.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>}
      <label><span>Порядок</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">По имени</option><option value="skills">Больше навыков</option><option value="score">Выше результат</option></select></label>
      <button className="people-export" type="button" onClick={() => onExport(filtered)} disabled={!filtered.length}>Экспорт CSV <span aria-hidden="true">↓</span></button>
    </div>

    <div className="people-metrics" aria-live="polite">
      <Metric label="Сотрудники" value={filtered.length} detail="В текущей выборке" />
      <Metric label="Подтверждённые навыки" value={skillCount} detail="Сумма навыков сотрудников" accent />
      <Metric label="Прошли тест в этом месяце" value={`${activeCount} / ${filtered.length}`} detail={state.month || 'Текущий месяц'} />
      <Metric label="Средний результат тестов" value={mean === null ? '—' : `${mean}%`} detail={allScores.length ? `По ${allScores.length} результатам за всё время` : 'Пока нет результатов'} />
    </div>

    <div className="people-content">
      <section className="people-table-card">
        <div className="people-section-title"><div><h2>{isHR ? 'Люди и их возможности' : 'Навыки вашей команды'}</h2><p>Откройте дерево, чтобы увидеть подтверждения и путь развития.</p></div><span className="people-count">{filtered.length}</span></div>
        {filtered.length ? <div className="people-table-scroll"><table className="people-table"><thead><tr>
          <th scope="col"><button type="button" onClick={() => setSort('name')}>Сотрудник {sort === 'name' && '↓'}</button></th>
          <th scope="col"><button type="button" onClick={() => setSort('skills')}>Навыки {sort === 'skills' && '↓'}</button></th>
          <th scope="col"><button type="button" onClick={() => setSort('score')}>Средний балл {sort === 'score' && '↓'}</button></th>
          <th scope="col">Последний тест</th><th scope="col"><span className="people-sr-only">Действие</span></th>
        </tr></thead><tbody>{filtered.map((employee) => <tr key={employee.id}>
          <td><div className="people-employee"><span className="people-avatar" aria-hidden="true">{employee.initials || employee.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><button className="people-name" type="button" onClick={() => onOpenEmployee(employee.id)}>{employee.name}</button><p>{employee.role} · {employee.grade}</p><span className="people-department">{employee.department}</span></div></div></td>
          <td><span className="people-skill-count">{(employee.skills || []).length}</span></td>
          <td><span className="people-score">{employeeAverage(employee) === null ? '—' : `${employeeAverage(employee)} / 100`}</span></td>
          <td className="people-date">{formatDate(latestDate(employee))}</td>
          <td><button className="people-open" type="button" onClick={() => onOpenEmployee(employee.id)} aria-label={`Открыть дерево: ${employee.name}`}>Открыть дерево <span aria-hidden="true">↗</span></button></td>
        </tr>)}</tbody></table></div> : <div className="people-empty"><h3>Совпадений нет</h3><p>Попробуйте другое имя, навык или подразделение.</p><button type="button" onClick={clearFilters}>Сбросить фильтры</button></div>}
      </section>

      <aside className="people-coverage"><div className="people-section-title"><div><p className="people-eyebrow">Сильные стороны</p><h2>Покрытие направлений</h2></div></div><p className="people-coverage-intro">Сколько сотрудников в выборке имеют хотя бы один подтверждённый навык в направлении.</p>
        {categories.length ? <div className="people-bars">{categories.map(({ name, count }) => <div className="people-bar-item" key={name}><div><span>{categoryLabels[name] || name}</span><strong>{count} / {filtered.length}</strong></div><div className="people-bar-track" role="meter" aria-label={categoryLabels[name] || name} aria-valuenow={count} aria-valuemin={0} aria-valuemax={filtered.length}><span style={{ width: `${count / filtered.length * 100}%` }} /></div></div>)}</div> : <p className="people-no-data">В этой выборке пока нет подтверждённых навыков.</p>}
        <div className="people-note"><strong>Каждая ветвь — подтверждение</strong><p>Результат теста помогает обсудить развитие. Он сам по себе не означает повышение или выполнение рабочего плана.</p></div>
      </aside>
    </div>
    <p className="people-footnote">Демонстрационные профили и тесты. Все показатели пересчитываются по выбранным сотрудникам. Переключение ролей показывает сценарии интерфейса и не является системой авторизации.</p>
  </section>;
}

function Metric({ label, value, detail, accent }) {
  return <article className={`people-metric${accent ? ' people-metric-accent' : ''}`}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}
