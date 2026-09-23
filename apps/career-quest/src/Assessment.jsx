import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import './assessment.css';

const LEVELS = { 1: 'Базовый', 2: 'Прикладной', 3: 'Продвинутый' };

export default function Assessment({ test, onSubmit, onClose, busy = false, error = '' }) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(() => test.questions.map(() => null));
  const [confirmClose, setConfirmClose] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const submittingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const locked = busy || submitting;
  const answered = answers.filter(answer => answer !== null).length;
  const question = test.questions[step];
  const requestClose = useCallback(() => {
    if (locked) return;
    if (answers.some(answer => answer !== null)) setConfirmClose(true);
    else onClose();
  }, [answers, locked, onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector('button')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (confirmClose) setConfirmClose(false);
        else requestClose();
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]') || [])
        .filter(element => element.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [confirmClose, requestClose]);

  useEffect(() => {
    if (confirmClose) dialogRef.current?.querySelector('[data-keep-assessment]')?.focus();
    else if (started) headingRef.current?.focus();
  }, [started, step, confirmClose]);

  async function submit() {
    if (answered !== test.questions.length || locked || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setLocalError('');
    try { await onSubmit([...answers]); }
    catch (cause) { setLocalError(cause instanceof Error ? cause.message : 'Не удалось сохранить результат. Ваши ответы сохранены в этом окне. Попробуйте ещё раз.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  }

  return <div className="assess-overlay">
    <section className="assess-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={locked}>
      <header className="assess-header">
        <span className="assess-kicker"><Icon name="sprout" size={17} /> CAREER QUEST · ДЕМО-ТЕСТ</span>
        <button className="assess-close" type="button" onClick={requestClose} disabled={locked} aria-label="Закрыть тест"><Icon name="x" size={22} /></button>
      </header>

      {confirmClose ? <div className="assess-content assess-leave">
        <div className="assess-symbol"><Icon name="book-open" size={32} /></div>
        <h2 id={titleId}>Выйти из теста?</h2>
        <p id={descriptionId}>Ответы в этой попытке не сохранятся. Тест месяца останется доступен: попытка расходуется только после отправки результата.</p>
        <div className="assess-leave-actions">
          <button type="button" className="assess-primary" data-keep-assessment onClick={() => setConfirmClose(false)}>Продолжить тест</button>
          <button type="button" className="assess-secondary" onClick={onClose}>Выйти без результата</button>
        </div>
      </div> : !started ? <>
        <div className="assess-content assess-intro">
          <div className="assess-symbol"><Icon name="book-open" size={32} /></div>
          <span className="assess-level">{LEVELS[test.level] || test.level}</span>
          <h2 id={titleId}>{test.title}</h2>
          <p id={descriptionId} className="assess-description">{test.description}</p>
          <div className="assess-meta"><span><Icon name="clock-3" size={17} /> Около {test.duration} мин</span><span><Icon name="book-open" size={17} /> {test.questions.length} вопросов</span><span><Icon name="shield-check" size={17} /> Порог: 80 из 100</span></div>
          <div className="assess-rule"><Icon name="calendar-days" size={23} /><div><strong>Один тест на выбор в месяц</strong><p>Отправка ответов расходует единственную попытку за месяц, даже если результат ниже порога. До отправки можно выйти и выбрать другой тест.</p></div></div>
          <div className="assess-outcome"><Icon name="sprout" size={23} /><div><strong>Подтвердите навык — вырастите ветку</strong><p>От 80 баллов навык появится на вашем дереве. Повторное подтверждение обновит существующую ветку.</p></div></div>
          <p className="assess-footnote">Учебный тест и правила демонстрации. Результат увидят HR и ваш руководитель. Подтверждение навыка не означает автоматического повышения.</p>
        </div>
        <footer className="assess-footer"><span>Вы сможете проверить ответы перед отправкой</span><button className="assess-primary" type="button" disabled={locked || !test.questions.length} onClick={() => setStarted(true)}>Начать тест <Icon name="arrow-right" size={18} /></button></footer>
      </> : <>
        <div className="assess-content assess-question-body">
          <div className="assess-test-heading"><div><span className="assess-level">{test.title}</span><h2 id={titleId} ref={headingRef} tabIndex={-1}>Вопрос {step + 1} из {test.questions.length}</h2></div><span className="assess-count">{answered}/{test.questions.length}<small>отвечено</small></span></div>
          <p id={descriptionId} className="assess-screen-reader">Выберите один вариант ответа. Можно возвращаться к предыдущим вопросам до отправки.</p>
          <div className="assess-progress" role="progressbar" aria-label="Прогресс ответов" aria-valuemin={0} aria-valuemax={test.questions.length} aria-valuenow={answered}><span style={{ width: `${answered / test.questions.length * 100}%` }} /></div>
          <nav className="assess-steps" aria-label="Вопросы теста">{test.questions.map((item, index) => <button type="button" key={item.id} disabled={locked} className={`${step === index ? 'is-current' : ''} ${answers[index] !== null ? 'is-answered' : ''}`} aria-label={`Вопрос ${index + 1}${answers[index] !== null ? ', ответ выбран' : ', без ответа'}`} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>{answers[index] !== null && step !== index ? <Icon name="check" size={16} /> : index + 1}</button>)}</nav>
          <fieldset className="assess-options" disabled={locked}><legend>{question.prompt}</legend>{question.options.map((option, index) => <label key={`${question.id}-${index}`} className={`assess-option ${answers[step] === index ? 'is-selected' : ''}`}><input type="radio" name={`answer-${question.id}`} value={index} checked={answers[step] === index} onChange={() => { setAnswers(current => current.map((answer, i) => i === step ? index : answer)); setLocalError(''); }} /><span className="assess-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span><span>{option}</span>{answers[step] === index && <Icon name="circle-check" size={21} />}</label>)}</fieldset>
          {step === test.questions.length - 1 && <div className="assess-submit-note"><Icon name="lock-keyhole" size={19} /><p>{answered === test.questions.length ? 'Все ответы выбраны. После отправки изменить результат или пройти другой тест в этом месяце нельзя.' : `Ответьте на все вопросы перед отправкой. Осталось: ${test.questions.length - answered}.`}</p></div>}
          {(error || localError) && <div className="assess-error" role="alert">{error || localError}</div>}
        </div>
        <footer className="assess-footer assess-question-footer"><button className="assess-secondary" type="button" disabled={locked || step === 0} onClick={() => setStep(current => current - 1)}><Icon name="arrow-left" size={18} /> Назад</button>{step < test.questions.length - 1 ? <button className="assess-primary" type="button" disabled={locked || answers[step] === null} onClick={() => setStep(current => current + 1)}>Далее <Icon name="arrow-right" size={18} /></button> : <button className="assess-primary" type="button" disabled={locked || answered !== test.questions.length} onClick={submit}>{locked ? 'Сохраняем результат…' : 'Завершить тест'} {!locked && <Icon name="check" size={18} />}</button>}</footer>
      </>}
    </section>
  </div>;
}
