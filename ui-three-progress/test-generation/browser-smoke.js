// Execute on /test-lab.html with: agent-browser eval --stdin < test-generation/browser-smoke.js
// Browser-only test harness. Intercepts the local generation request; never calls OpenAI.
(async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const $ = selector => document.querySelector(selector);
  const click = selector => { assert($(selector), `Missing ${selector}`); $(selector).click(); };
  const change = (selector, value) => { $(selector).value = value; $(selector).dispatchEvent(new Event('change', { bubbles: true })); };
  const until = async predicate => {
    const start = Date.now();
    while (!predicate()) {
      if (Date.now() - start > 4000) throw new Error('UI did not settle');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const { POSITIONS, getSkill } = await import('/test-generation/catalog.mjs');
  const originalFetch = window.fetch;
  const requests = [];
  let mode = 'success';
  let failOnce = true;
  let download;
  const originalCreateURL = URL.createObjectURL;
  URL.createObjectURL = blob => { download = blob; return originalCreateURL(blob); };
  window.fetch = async (url, options) => {
    if (url !== '/api/generate-test') return originalFetch(url, options);
    const { config, apiKey } = JSON.parse(options.body);
    assert(apiKey === 'sk-browser-test-not-real', 'Unexpected test key');
    requests.push(config);
    if (mode === 'cancel') return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
    if (mode === 'auth') return new Response(JSON.stringify({ error: 'Ключ отклонён.' }), { status: 401 });
    if (mode === 'partial' && config.skillId === 'typescript' && failOnce) {
      failOnce = false;
      return new Response(JSON.stringify({ error: 'Временная ошибка.' }), { status: 502 });
    }
    return new Response(JSON.stringify({ assessment: { id: crypto.randomUUID(), title: getSkill(config.skillId).title, instructions: 'Выберите один ответ.', config, passScore: 80, questions: Array.from({ length: config.questionCount }, (_, i) => ({ id: `q${i + 1}`, text: `Сценарий ${i + 1} <img src=x onerror=window.__injected=true>`, topic: getSkill(config.skillId).topics[i % 4], options: ['Ответ А', 'Ответ Б', 'Ответ В', 'Ответ Г'], correct: i % 4, explanation: `Объяснение ${i + 1}: правильный выбор учитывает ограничения.` })) } }), { headers: { 'Content-Type': 'application/json' } });
  };
  const generate = async () => { $('#generation-form').requestSubmit(); await until(() => !$('#generation-fields').disabled); };
  const checks = [];
  try {
    for (const position of POSITIONS) {
      change('#position', position.id);
      assert(document.querySelectorAll('#skills input').length === position.skills.length, 'Role skill coverage');
      assert($('#prompt-preview').textContent.includes(position.title), 'Role in prompt');
    }
    checks.push('All 8 role mappings and prompt previews');
    change('#position', 'middle-frontend');
    change('#question-count', '5');
    change('#language', 'en');
    change('#level', 'senior');
    click('#select-all'); click('#select-all');
    assert($('#generate').disabled, 'Empty selection must disable generation');
    $('#skills input[value="architecture"]').checked = true;
    $('#skills').dispatchEvent(new Event('change', { bubbles: true }));
    $('#api-key').value = 'sk-browser-test-not-real';
    await generate();
    assert(requests.at(-1).language === 'en' && requests.at(-1).level === 'senior', 'Generation config');
    assert($('#test-count').textContent === '1', 'Generated test appears');
    click('[data-action="take"]');
    assert($('#assessment-dialog').open, 'Test opens');
    assert($('[data-action="next"]').disabled, 'Cannot skip unanswered question');
    assert(!$('#assessment-content').textContent.includes('Объяснение'), 'Answer key hidden before submission');
    assert(!$('#assessment-content img') && !window.__injected, 'Model output must be escaped');
    click('[data-action="answer"][data-answer="0"]');
    click('[data-action="next"]');
    click('[data-action="previous"]');
    assert($('[data-action="answer"][data-answer="0"]').getAttribute('aria-pressed') === 'true', 'Back preserves answer');
    click('[data-action="close-quiz"]'); click('[data-action="take"]');
    assert($('[data-action="answer"][data-answer="0"]').getAttribute('aria-pressed') === 'true', 'Resume preserves answer');
    // Change the first answer, then answer the rest correctly: exactly 80%.
    click('[data-action="answer"][data-answer="3"]'); click('[data-action="next"]');
    for (let i = 1; i < 5; i++) { click(`[data-action="answer"][data-answer="${i % 4}"]`); click('[data-action="next"]'); }
    assert($('.result-score').textContent === '80%', 'Score uses generated answer keys');
    assert($('#assessment-content').textContent.includes('Тест пройден'), '80% passes');
    assert(document.querySelectorAll('.review-explanation').length === 5, 'Explanations after grading');
    click('[data-action="retake"]');
    assert($('[data-action="next"]').disabled, 'Retake clears answers');
    for (let i = 0; i < 5; i++) { click(`[data-action="answer"][data-answer="${(i + 1) % 4}"]`); click('[data-action="next"]'); }
    assert($('.result-score').textContent === '0%' && $('.result-summary.failed'), 'Failed score');
    click('[data-action="close-quiz"]');
    checks.push('Generate, escaped content, answer changes, back/resume, 80% pass, 0% fail, retake');
    mode = 'partial';
    change('#position', 'middle-frontend');
    document.querySelectorAll('#skills input').forEach(input => { input.checked = ['react', 'typescript', 'architecture'].includes(input.value); });
    $('#skills').dispatchEvent(new Event('change', { bubbles: true }));
    await generate();
    assert($('#test-count').textContent === '3', 'Batch keeps successes when one fails');
    assert(document.querySelectorAll('[data-action="retry"]').length === 1, 'Failed skill has individual retry');
    const beforeRetry = requests.length;
    click('[data-action="retry"]'); await until(() => !$('#generation-fields').disabled);
    assert(requests.length === beforeRetry + 1 && $('#test-count').textContent === '4', 'Retry only failed skill');
    checks.push('Batch partial success and per-skill retry');
    mode = 'auth';
    const beforeAuth = requests.length;
    await generate();
    assert(requests.length === beforeAuth + 1, 'Auth failure stops remaining requests');
    assert($('#test-count').textContent === '4', 'Failure preserves previous tests');
    mode = 'cancel';
    $('#generation-form').requestSubmit();
    assert($('#generation-fields').disabled, 'Settings disabled while generating');
    click('#cancel'); await until(() => !$('#generation-fields').disabled);
    assert($('#test-count').textContent === '4', 'Cancel preserves existing tests');
    checks.push('Authentication failure and cancellation stop queue');
    click('#export-prompts');
    const prompts = JSON.parse(await download.text());
    assert(prompts.prompts.length === 22 && prompts.positions.length === 8, 'Complete prompt export');
    click('#export-tests');
    const tests = JSON.parse(await download.text());
    assert(tests.assessments.length === 4, 'Exports only ready assessments');
    assert(!(await download.text()).includes('sk-browser-test'), 'No key in export');
    assert(!Object.values(localStorage).some(value => value.includes('sk-browser-test')), 'No key in local storage');
    assert(!Object.values(sessionStorage).some(value => value.includes('sk-browser-test')), 'No key in session storage');
    click('#clear-key');
    assert($('#api-key').value === '', 'Clear key');
    checks.push('Prompt/test export, ephemeral key and clear key');
    return { passed: true, checks, requests: requests.length };
  } finally {
    window.fetch = originalFetch;
    URL.createObjectURL = originalCreateURL;
    $('#api-key').value = '';
    if ($('#assessment-dialog').open) $('#assessment-dialog').close();
  }
})();
