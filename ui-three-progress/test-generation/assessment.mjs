import { getSkill } from './catalog.mjs';
import { validateConfig, PASS_SCORE } from './prompts.mjs';

const object = properties => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const string = { type: 'string', minLength: 1 };
export function assessmentSchema(input) {
  const config = validateConfig(input);
  return object({
    title: string,
    instructions: string,
    questions: { type: 'array', minItems: config.questionCount, maxItems: config.questionCount, items: object({
      id: string, text: string,
      topic: { type: 'string', enum: getSkill(config.skillId).topics },
      options: { type: 'array', minItems: 4, maxItems: 4, items: string },
      correct: { type: 'integer', minimum: 0, maximum: 3 },
      explanation: string,
    }) },
  });
}

const normalize = text => text.trim().replace(/\s+/g, ' ').toLowerCase();
const nonempty = (text, max = 12000) => typeof text === 'string' && text.trim().length > 0 && text.length <= max;
export function validateAssessment(value, input) {
  const config = validateConfig(input);
  const invalid = () => { throw new Error('Модель вернула некорректный тест. Попробуйте сгенерировать заново.'); };
  if (!value || !nonempty(value.title, 500) || !nonempty(value.instructions, 2000) || !Array.isArray(value.questions) || value.questions.length !== config.questionCount) invalid();
  const seen = new Set();
  const topics = new Set();
  value.questions.forEach((q, i) => {
    if (!q || q.id !== `q${i + 1}` || !nonempty(q.text) || !nonempty(q.explanation) || !Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(o => nonempty(o, 4000)) || !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3 || !getSkill(config.skillId).topics.includes(q.topic)) invalid();
    if (new Set(q.options.map(normalize)).size !== 4 || seen.has(normalize(q.text))) invalid();
    seen.add(normalize(q.text));
    topics.add(q.topic);
  });
  if (topics.size !== getSkill(config.skillId).topics.length) invalid();
  // Whitelist fields instead of propagating unexpected model output.
  return { title: value.title.trim(), instructions: value.instructions.trim(), questions: value.questions.map(q => ({ id: q.id, text: q.text.trim(), topic: q.topic, options: q.options.map(o => o.trim()), correct: q.correct, explanation: q.explanation.trim() })) };
}

export function shuffleOptions(assessment, random = Math.random) {
  return { ...assessment, questions: assessment.questions.map(question => {
    const indices = [0, 1, 2, 3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return { ...question, options: indices.map(i => question.options[i]), correct: indices.indexOf(question.correct) };
  }) };
}

export function gradeAssessment(assessment, answers) {
  if (!Array.isArray(answers) || answers.length !== assessment.questions.length || Array.from(answers).some(answer => !Number.isInteger(answer) || answer < 0 || answer > 3)) throw new Error('Ответьте на все вопросы.');
  const correct = assessment.questions.filter((q, i) => q.correct === answers[i]).length;
  const percent = correct / assessment.questions.length * 100;
  return { correct, total: assessment.questions.length, score: Math.round(percent), passed: percent >= PASS_SCORE, passScore: PASS_SCORE };
}
