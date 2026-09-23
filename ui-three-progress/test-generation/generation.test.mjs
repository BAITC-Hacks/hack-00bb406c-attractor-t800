import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SKILLS, POSITIONS, getSkill } from './catalog.mjs';
import { buildPrompt, exportPromptLibrary, validateConfig } from './prompts.mjs';
import { assessmentSchema, validateAssessment, shuffleOptions, gradeAssessment } from './assessment.mjs';
import { generateAssessment } from './openai.mjs';

const config = { positionId: 'middle-frontend', skillId: 'architecture', level: 'middle', language: 'ru', questionCount: 5, model: 'gpt-4.1-mini' };
const apiKey = 'sk-test-key-not-a-real-key';
const fixture = (count = 5, skillId = 'architecture') => ({ title: 'Practice', instructions: 'Choose the best answer.', questions: Array.from({ length: count }, (_, i) => ({ id: `q${i + 1}`, text: `Scenario ${i + 1}: choose a solution.`, topic: getSkill(skillId).topics[i % 4], options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: i % 4, explanation: `Explanation ${i + 1}` })) });
const provider = value => ({ status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
const response = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

test('every existing demo test has its own specialized prompt; every role skill resolves', async () => {
  const data = JSON.parse(await readFile(new URL('../mock-data.json', import.meta.url)));
  assert.equal(SKILLS.length, 22);
  assert.equal(POSITIONS.filter(p => p.source === 'brief').length, 4);
  assert.deepEqual(POSITIONS.filter(p => p.source === 'existing-app').map(p => p.title).sort(), [...new Set([...data.employees.map(e => e.role), ...data.goals.map(g => g.title)])].sort());
  for (const item of data.tests) assert.ok(getSkill(item.id), item.id);
  const templates = exportPromptLibrary().prompts.map(p => p.template);
  assert.equal(new Set(templates).size, SKILLS.length);
  assert.deepEqual(new Set(POSITIONS.flatMap(p => p.skills)), new Set(SKILLS.map(s => s.id)));
});

test('all role/skill pairs build complete role-specific prompts and strict schemas', () => {
  for (const position of POSITIONS) for (const skillId of position.skills) {
    const input = { ...config, positionId: position.id, skillId, level: position.level, language: 'kk' };
    const prompt = buildPrompt(input);
    assert.ok(prompt.user.includes(position.title));
    assert.ok(prompt.user.includes(getSkill(skillId).focus));
    assert.ok(prompt.user.includes('Қазақша'));
    assert.ok(!prompt.user.includes('{{'));
    const schema = assessmentSchema(input);
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.questions.minItems, 5);
    assert.equal(schema.properties.questions.items.additionalProperties, false);
    assert.deepEqual(schema.properties.questions.items.properties.topic.enum, getSkill(skillId).topics);
  }
});

test('reject invalid config before any request and discard unrelated properties', () => {
  for (const patch of [{ positionId: 'unknown' }, { skillId: 'invented' }, { positionId: 'hr', skillId: 'react' }, { level: '__proto__' }, { language: 'constructor' }, { questionCount: 0 }, { questionCount: '10' }, { questionCount: 21 }, { model: 'invalid model' }]) assert.throws(() => validateConfig({ ...config, ...patch }));
  assert.deepEqual(validateConfig({ ...config, apiKey, employeeName: 'private' }), config);
});

test('reject duplicate questions/options, wrong counts, missing topics and invalid answer keys', () => {
  const mutations = [
    value => value.questions.pop(),
    value => { value.questions[0].correct = 4; },
    value => { value.questions[0].correct = '0'; },
    value => { value.questions[0].options[1] = ' OPTION A '; },
    value => { value.questions[1].text = value.questions[0].text; },
    value => { value.questions[0].explanation = ''; },
    value => { value.questions[0].id = 'q2'; },
    value => { value.questions[0].topic = 'Another skill'; },
    value => { value.questions.forEach(q => { q.topic = getSkill('architecture').topics[0]; }); },
  ];
  for (const mutate of mutations) { const value = fixture(); mutate(value); assert.throws(() => validateAssessment(value, config)); }
  assert.deepEqual(validateAssessment(fixture(), config), fixture());
});

test('option shuffling preserves the correct answer and does not mutate source data', () => {
  const original = fixture();
  const shuffled = shuffleOptions(original, () => 0);
  shuffled.questions.forEach((q, index) => assert.equal(q.options[q.correct], original.questions[index].options[original.questions[index].correct]));
  assert.deepEqual(original, fixture());
  assert.notDeepEqual(shuffled.questions[0].options, original.questions[0].options);
});

test('grading uses actual generated keys, enforces completion and handles pass threshold', () => {
  const value = fixture();
  const answers = value.questions.map(q => q.correct);
  assert.equal(gradeAssessment(value, answers).score, 100);
  answers[0] = 3;
  assert.deepEqual(gradeAssessment(value, answers), { score: 80, passed: true, correct: 4, total: 5, passScore: 80 });
  answers[1] = 3;
  assert.equal(gradeAssessment(value, answers).passed, false);
  assert.throws(() => gradeAssessment(value, []));
  assert.throws(() => gradeAssessment(value, new Array(5)));
  assert.throws(() => gradeAssessment(value, [0, 1, 2, 3, 4]));
  assert.throws(() => gradeAssessment(value, [0, 1, 2, 3, '0']));
});

test('OpenAI request uses Responses API, strict schema and no storage; result excludes key', async () => {
  const result = await generateAssessment(config, { apiKey, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, `Bearer ${apiKey}`);
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.strict, true);
    assert.equal(payload.text.format.type, 'json_schema');
    assert.equal(payload.model, config.model);
    assert.equal(payload.input, buildPrompt(config).user);
    assert.ok(!options.body.includes(apiKey));
    return response(provider(fixture()));
  } });
  assert.equal(result.config.skillId, 'architecture');
  assert.equal(result.questions.length, 5);
  assert.equal(result.passScore, 80);
  assert.ok(result.id);
  assert.ok(!JSON.stringify(result).includes(apiKey));
});

test('provider failures are actionable and never include raw provider secrets', async () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    await assert.rejects(generateAssessment(config, { apiKey, fetchImpl: async () => new Response(`secret ${apiKey}`, { status }) }), error => error.status === (status >= 500 ? 502 : status) && !error.message.includes(apiKey));
  }
});

test('refusal, incomplete output and malformed JSON never become a test', async () => {
  for (const body of [
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] },
    { ...provider(fixture()), status: 'incomplete' },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{' }] }] },
    provider({ ...fixture(), questions: [] }),
  ]) await assert.rejects(generateAssessment(config, { apiKey, fetchImpl: async () => response(body) }));
});

test('invalid credentials and config never reach the network', async () => {
  let requests = 0;
  const fetchImpl = async () => { requests++; return response(provider(fixture())); };
  await assert.rejects(generateAssessment(config, { apiKey: '', fetchImpl }), { status: 400 });
  await assert.rejects(generateAssessment({ ...config, questionCount: 100 }, { apiKey, fetchImpl }), { status: 400 });
  assert.equal(requests, 0);
});

test('transport handles cancellation and timeouts without leaking errors', async () => {
  const controller = new AbortController();
  controller.abort();
  const fetchImpl = async (_, { signal }) => { signal.throwIfAborted(); };
  await assert.rejects(generateAssessment(config, { apiKey, signal: controller.signal, fetchImpl }), { status: 408 });
  await assert.rejects(generateAssessment(config, { apiKey, fetchImpl: async () => { throw new Error(`secret ${apiKey}`); } }), error => !error.message.includes(apiKey));
  // Keep a referenced timer while AbortSignal.timeout's unreferenced timer fires.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(generateAssessment(config, { apiKey, timeoutMs: 5, fetchImpl: (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) }), { status: 408 });
  } finally { clearTimeout(keepAlive); }
});
