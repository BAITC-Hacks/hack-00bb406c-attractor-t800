import { SKILLS, POSITIONS, SOURCE_NOTE, LEVELS, LANGUAGES, getSkill, getPosition } from './test-generation/catalog.mjs';
import { buildPrompt, exportPromptLibrary, validateConfig, PASS_SCORE } from './test-generation/prompts.mjs';
import { gradeAssessment } from './test-generation/assessment.mjs';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const items = [];
let busy = false;
let controller;
let activeItem;

$('#position').innerHTML = `<optgroup label="Роли из брифа">${POSITIONS.filter(p => p.source === 'brief').map(option).join('')}</optgroup><optgroup label="Должности из демо">${POSITIONS.filter(p => p.source !== 'brief').map(option).join('')}</optgroup>`;
$('#position').value = 'middle-frontend';
$('#source-note').textContent = SOURCE_NOTE;
$('#position-sources').innerHTML = ['brief', 'existing-app'].map(source => `<strong>${source === 'brief' ? 'В брифе' : 'В существующем демо'}</strong><ul>${POSITIONS.filter(p => p.source === source).map(p => `<li>${escape(p.title)}<br>${p.skills.map(id => escape(getSkill(id).title)).join(' · ')}</li>`).join('')}</ul>`).join('');
$('#prompt-count').textContent = `${SKILLS.length} отдельных промптов · ${POSITIONS.length} ролей и должностей`;

function option(item) { return `<option value="${item.id}">${escape(item.title)}</option>`; }
function selectedSkills() { return [...document.querySelectorAll('#skills input:checked')].map(input => input.value); }
function configFor(skillId) {
  return validateConfig({ positionId: $('#position').value, skillId, level: $('#level').value, language: $('#language').value, questionCount: Number($('#question-count').value), model: $('#model').value.trim() });
}
function updatePosition() {
  const position = getPosition($('#position').value);
  $('#position-description').textContent = position.description;
  $('#level').value = position.level;
  const initial = position.skills.includes('architecture') ? 'architecture' : position.skills[0];
  $('#skills').innerHTML = position.skills.map(id => `<label class="skill-option"><input type="checkbox" value="${id}" ${id === initial ? 'checked' : ''}><span>${escape(getSkill(id).title)}</span></label>`).join('');
  $('#prompt-skill').innerHTML = position.skills.map(id => option(getSkill(id))).join('');
  $('#prompt-skill').value = initial;
  updateSelection();
  updatePrompt();
}
function updateSelection() {
  const count = selectedSkills().length;
  $('#generate').textContent = count > 1 ? `Сгенерировать тесты · ${count}` : 'Сгенерировать тест';
  $('#generate').disabled = busy || count === 0;
  $('#select-all').textContent = count === getPosition($('#position').value).skills.length ? 'Снять выбор' : 'Выбрать все';
  $('#generation-summary').textContent = count ? `${count} тест(ов) × ${$('#question-count').value} вопросов · ${count} запрос(ов) к OpenAI` : 'Выберите хотя бы один навык';
}
function promptText() {
  const prompt = buildPrompt(configFor($('#prompt-skill').value));
  return `SYSTEM\n${prompt.system}\n\nUSER\n${prompt.user}`;
}
function updatePrompt() {
  try { $('#prompt-preview').textContent = promptText(); }
  catch (error) { $('#prompt-preview').textContent = error.message; }
}
function errorMessage(message = '') {
  $('#generation-error').textContent = message;
  $('#generation-error').hidden = !message;
}
function download(name, value, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderLibrary() {
  const ready = items.filter(item => item.status === 'ready');
  $('#test-count').textContent = ready.length;
  $('#export-tests').disabled = ready.length === 0;
  $('#test-library').innerHTML = items.length ? items.map(item => {
    const skill = getSkill(item.config.skillId);
    const state = { queued: 'В очереди', running: 'Генерация…', ready: 'Готов к прохождению', failed: 'Ошибка генерации', cancelled: 'Не сгенерирован' }[item.status];
    const result = item.result;
    return `<article class="test-card" data-test-id="${item.id}"><span class="badge ${['failed', 'cancelled'].includes(item.status) || result && !result.passed ? 'failed' : ''}">${result ? `${result.passed ? 'Пройдено' : 'Повторить'} · ${result.score}%` : state}</span><h3>${escape(skill.title)}</h3><div class="meta">${escape(getPosition(item.config.positionId).title)} · ${LEVELS[item.config.level]}<br>${item.config.questionCount} вопросов · ${LANGUAGES[item.config.language]} · порог ${PASS_SCORE}%</div>${item.error ? `<p class="error">${escape(item.error)}</p>` : ''}<div class="card-actions">${item.status === 'ready' ? `<span class="hint">${result ? `${result.correct} из ${result.total} верно` : item.answers.length ? 'Есть сохранённые ответы' : 'Ответы откроются после завершения'}</span><button class="button secondary" data-action="take" data-id="${item.id}">${result ? 'Разбор ответов' : item.answers.length ? 'Продолжить тест' : 'Пройти тест →'}</button>` : ['failed', 'cancelled'].includes(item.status) ? `<button class="button secondary" data-action="retry" data-id="${item.id}" ${busy ? 'disabled' : ''}>Повторить генерацию</button>` : '<span class="hint">Каждый навык генерируется отдельно.</span>'}</div></article>`;
  }).join('') : `<div class="empty-state"><div class="empty-symbol" aria-hidden="true">✳</div><h3>Ваш следующий шаг — здесь</h3><p>Начните с одного навыка или выберите все навыки вашей роли.</p></div>`;
}

async function generate(queue) {
  if (busy) return;
  const apiKey = $('#api-key').value.trim();
  if (!/^sk-[a-zA-Z0-9_-]{10,500}$/.test(apiKey)) { errorMessage('Введите корректный OpenAI API key.'); $('#api-key').focus(); return; }
  errorMessage();
  busy = true;
  controller = new AbortController();
  $('#generation-fields').disabled = true;
  $('#cancel').hidden = false;
  $('#cancel').disabled = false;
  updateSelection();
  for (const item of queue) { item.status = 'queued'; item.error = ''; if (!items.includes(item)) items.unshift(item); }
  let completed = 0;
  let failed = 0;
  let halted = false;
  try {
    for (const [index, item] of queue.entries()) {
      if (controller.signal.aborted || halted) { item.status = 'cancelled'; continue; }
      item.status = 'running';
      $('#generation-status').textContent = `${index + 1} / ${queue.length} · ${getSkill(item.config.skillId).title}. Обычно это занимает до двух минут.`;
      renderLibrary();
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(135000)]);
        const response = await fetch('/api/generate-test', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey, config: item.config }) });
        let body;
        try { body = await response.json(); } catch { throw new Error('Сервер вернул некорректный ответ. Перезапустите локальный сервер.'); }
        if (!response.ok) {
          if ([400, 401, 403, 404, 429].includes(response.status)) halted = true;
          throw new Error(body.error || 'Не удалось сгенерировать тест.');
        }
        item.assessment = body.assessment;
        item.status = 'ready';
        completed++;
      } catch (error) {
        item.status = controller.signal.aborted ? 'cancelled' : 'failed';
        item.error = controller.signal.aborted ? 'Генерация остановлена.' : error.name === 'TimeoutError' ? 'Время ожидания истекло. Повторите генерацию.' : error.message === 'Failed to fetch' ? 'Локальный сервер недоступен. Проверьте, что он запущен.' : error.message;
        if (!controller.signal.aborted) failed++;
      }
      renderLibrary();
    }
  } finally {
    busy = false;
    $('#generation-fields').disabled = false;
    $('#cancel').hidden = true;
    updateSelection();
    renderLibrary();
    const cancelled = queue.filter(item => item.status === 'cancelled').length;
    $('#generation-status').textContent = `Готово: ${completed} из ${queue.length}.${failed ? ` Ошибок: ${failed}.` : ''}${cancelled ? ` Не сгенерировано: ${cancelled}.` : ''} ${completed ? 'Можно приступать к тестам.' : 'Проверьте причину и повторите генерацию.'}`;
  }
}

function openAssessment(item) {
  activeItem = item;
  renderAssessment();
  $('#assessment-dialog').showModal();
}
function renderAssessment() {
  const item = activeItem;
  const assessment = item.assessment;
  const heading = `<div class="quiz-heading"><div><div class="eyebrow">${escape(getSkill(item.config.skillId).title)}</div><h2 id="assessment-heading">${escape(assessment.title)}</h2></div><button type="button" class="close-button" data-action="close-quiz" aria-label="Закрыть тест">×</button></div>`;
  if (item.result) {
    const result = item.result;
    $('#assessment-content').innerHTML = `${heading}<section class="result-summary ${result.passed ? '' : 'failed'}"><div class="result-score">${result.score}%</div><h3>${result.passed ? 'Тест пройден' : 'Есть над чем поработать'}</h3><p>${result.correct} из ${result.total} верно · Порог ${result.passScore}%</p><p>Разберите ответы и выберите, что потренировать дальше. Это результат практики, а не оценка рабочих достижений.</p></section><h3>Разбор ответов</h3>${assessment.questions.map((q, index) => `<div class="review-question"><strong>${index + 1}. ${escape(q.text)}</strong><p class="${item.answers[index] === q.correct ? 'correct-answer' : 'wrong-answer'}">Ваш ответ: ${escape(q.options[item.answers[index]])}</p>${item.answers[index] !== q.correct ? `<p class="correct-answer">Правильный ответ: ${escape(q.options[q.correct])}</p>` : ''}<p class="review-explanation">${escape(q.explanation)}</p></div>`).join('')}<div class="quiz-navigation"><button class="button secondary" data-action="retake">Пройти ещё раз</button><button class="button primary" data-action="close-quiz">К моим тестам</button></div><p class="quiz-save">Повторное прохождение использует те же вопросы. Для новой попытки с новыми вопросами запустите генерацию.</p>`;
  } else {
    const index = item.index;
    const q = assessment.questions[index];
    $('#assessment-content').innerHTML = `${heading}<div class="quiz-meta"><span>Вопрос ${index + 1} из ${assessment.questions.length}</span><span>${LEVELS[item.config.level]} · ${PASS_SCORE}% для прохождения</span></div><div class="quiz-progress"><span style="width:${(index + 1) / assessment.questions.length * 100}%"></span></div>${index === 0 ? `<p class="hint">${escape(assessment.instructions)}</p>` : ''}<h3 class="quiz-question" tabindex="-1">${escape(q.text)}</h3><div role="group" aria-label="Варианты ответа">${q.options.map((answer, i) => `<button class="answer ${item.answers[index] === i ? 'selected' : ''}" data-action="answer" data-answer="${i}" aria-pressed="${item.answers[index] === i}"><span class="letter">${'ABCD'[i]}</span>${escape(answer)}</button>`).join('')}</div><div class="quiz-navigation"><button class="button secondary" data-action="previous" ${index === 0 ? 'disabled' : ''}>← Назад</button><button class="button primary" data-action="next" ${item.answers[index] === undefined ? 'disabled' : ''}>${index + 1 === assessment.questions.length ? 'Завершить тест' : 'Дальше →'}</button></div><p class="quiz-save">Один правильный ответ на вопрос. Можно вернуться назад или закрыть тест — ответы сохранятся до перезагрузки страницы.</p>`;
  }
}

$('#position').addEventListener('change', updatePosition);
$('#skills').addEventListener('change', updateSelection);
$('#select-all').addEventListener('click', () => {
  const allSelected = selectedSkills().length === getPosition($('#position').value).skills.length;
  document.querySelectorAll('#skills input').forEach(input => { input.checked = !allSelected; });
  updateSelection();
});
for (const id of ['level', 'language', 'question-count', 'prompt-skill', 'model']) $(`#${id}`).addEventListener('change', () => { updatePrompt(); updateSelection(); });
$('#clear-key').addEventListener('click', () => { $('#api-key').value = ''; $('#api-key').focus(); });
$('#export-prompts').addEventListener('click', () => download('career-quest-prompts.json', exportPromptLibrary()));
$('#export-tests').addEventListener('click', () => download('career-quest-tests-with-answers.json', { version: '1.0.0', notice: 'Practice export includes answer keys. Keep on the server for a production assessment.', assessments: items.filter(item => item.status === 'ready').map(item => ({ ...item.assessment, attempt: item.result ? { answers: item.answers, result: item.result } : null })) }));
$('#copy-prompt').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(promptText()); $('#copy-status').textContent = 'Промпт скопирован.'; }
  catch { $('#prompt-details').open = true; $('#copy-status').textContent = 'Не удалось скопировать. Выделите текст промпта или скачайте все промпты.'; }
});
$('#generation-form').addEventListener('submit', event => {
  event.preventDefault();
  if (busy) return;
  try {
    const queue = selectedSkills().map(skillId => ({ id: crypto.randomUUID(), config: configFor(skillId), status: 'queued', answers: [], index: 0, result: null }));
    if (!queue.length) { errorMessage('Выберите хотя бы один навык.'); return; }
    void generate(queue);
  } catch (error) { errorMessage(error.message); }
});
$('#cancel').addEventListener('click', () => { controller?.abort(); $('#cancel').disabled = true; });
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (action === 'take') { openAssessment(items.find(item => item.id === id)); return; }
  if (action === 'retry') { void generate([items.find(item => item.id === id)]); return; }
  if (action === 'close-quiz') { $('#assessment-dialog').close(); renderLibrary(); return; }
  if (!activeItem) return;
  if (action === 'answer') {
    activeItem.answers[activeItem.index] = Number(button.dataset.answer);
    renderAssessment();
    $(`[data-action="answer"][data-answer="${button.dataset.answer}"]`).focus();
    return;
  }
  if (action === 'previous' && activeItem.index > 0) activeItem.index--;
  else if (action === 'next') {
    if (activeItem.answers[activeItem.index] === undefined) return;
    if (activeItem.index + 1 === activeItem.assessment.questions.length) {
      activeItem.result = gradeAssessment(activeItem.assessment, activeItem.answers);
      renderLibrary();
    } else activeItem.index++;
  } else if (action === 'retake') { activeItem.index = 0; activeItem.answers = []; activeItem.result = null; renderLibrary(); }
  else return;
  renderAssessment();
  $('#assessment-dialog').scrollTop = 0;
  const target = $('.quiz-question') || $('#assessment-heading');
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
});
$('#assessment-dialog').addEventListener('cancel', () => renderLibrary());
window.addEventListener('pagehide', () => { controller?.abort(); $('#api-key').value = ''; });

updatePosition();
renderLibrary();
