import React, { useState } from 'react';

export default function ImportPanel({ api, onChange }) {
  const [files, setFiles] = useState({});
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function choose(key, file) {
    setPreview(null); setMessage(''); setBusy(true);
    try { const content = file ? await file.text() : null; setFiles(previous => ({ ...previous, [key]: content })); }
    catch { setMessage('Не удалось прочитать файл'); }
    finally { setBusy(false); }
  }
  async function run(action) {
    setBusy(true); setMessage('');
    try {
      const body = action === 'reset' ? { confirmed: true } : { ...files, confirmation: action === 'apply' ? preview.confirmation : null };
      const result = await api(`/api/operator/import/${action}`, { method: 'POST', body: JSON.stringify(body) });
      if (action === 'preview') setPreview(result);
      else {
        setPreview(null);
        setMessage(action === 'reset' ? `Удалено профилей: ${result.deleted_profiles}, строк истории: ${result.deleted_history}.` : `Импорт применён. Новых профилей: ${result.new_profiles}, строк: ${result.new_history}.`);
        await onChange();
      }
    } catch (e) { setPreview(null); setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <section className="operator-card" aria-label="Импорт проверочных данных">
    <h2>Проверочные профили жюри</h2>
    <p>Загрузите employees.json и/или activity_history.csv в официальной схеме. Сначала проверьте результат, затем подтвердите применение.</p>
    <label className="clock-label">Профили — employees.json<input disabled={busy} type="file" accept=".json" onChange={e => choose('employees_json', e.target.files[0])}/></label>
    <label className="clock-label">История — activity_history.csv<input disabled={busy} type="file" accept=".csv" onChange={e => choose('activity_history_csv', e.target.files[0])}/></label>
    <button className="primary-button" disabled={busy || !Object.values(files).some(value => value !== null)} onClick={() => run('preview')}>Предпросмотр</button>
    {preview && <div aria-live="polite">
      <p>Новые профили: <b>{preview.new_profiles}</b> · Новые строки: <b>{preview.new_history}</b> · Неизменные повторы: <b>{preview.unchanged}</b></p>
      <p>Затронутые сотрудники: {preview.affected_employees.join(', ') || 'нет'}</p>
      {preview.errors.length > 0 ? <ul className="error-box">{preview.errors.map((error, index) => <li key={index}>{error.file}, строка {error.row}, {error.field}: {error.message}</li>)}</ul> : <button className="primary-button" disabled={busy} onClick={() => run('apply')}>Подтвердить применение</button>}
    </div>}
    <p>Сброс удаляет импортированные профили, историю и связанные данные. Официальный набор и демонстрационные рабочие результаты сохраняются.</p>
    <button className="secondary-button" disabled={busy} onClick={() => { if (window.confirm('Удалить весь импортированный слой и связанные данные?')) run('reset'); }}>Сбросить проверочные данные</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
