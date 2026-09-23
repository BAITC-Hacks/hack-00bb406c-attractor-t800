import { CATALOG_VERSION, SKILLS, POSITIONS, LEVELS, LANGUAGES, getSkill, getPosition } from './catalog.mjs';

export const PROMPT_VERSION = '1.0.0';
export const DEFAULT_MODEL = 'gpt-4.1-mini';
export const PASS_SCORE = 80;
const DIFFICULTY = {
  junior: 'Foundational application: one clearly scoped problem, explicit context, common workflows, no assumed ownership of an entire system.',
  middle: 'Independent professional practice: realistic constraints, multi-step reasoning, debugging and choosing between plausible tradeoffs.',
  senior: 'Advanced judgment: competing constraints, ambiguous evidence resolved by stated assumptions, long-term consequences and cross-team impact. Avoid obscure trivia.',
};

export function validateConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Не заданы параметры теста.');
  const { positionId, skillId, level, language, questionCount } = input;
  const position = getPosition(positionId);
  if (!position) throw new Error('Неизвестная роль.');
  if (!getSkill(skillId) || !position.skills.includes(skillId)) throw new Error('Навык не входит в выбранную роль.');
  if (!Object.hasOwn(LEVELS, level)) throw new Error('Неизвестный уровень.');
  if (!Object.hasOwn(LANGUAGES, language)) throw new Error('Неизвестный язык.');
  if (!Number.isInteger(questionCount) || questionCount < 5 || questionCount > 20) throw new Error('Выберите от 5 до 20 вопросов.');
  const model = input.model ?? DEFAULT_MODEL;
  if (typeof model !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(model)) throw new Error('Некорректное имя модели.');
  return { positionId, skillId, level, language, questionCount, model };
}

export const SYSTEM_PROMPT = `You create formative professional skill assessments for Career Quest, a fictional employee-development prototype.
Generate one assessment of ONE skill, calibrated to the specified role and level. Return only the required JSON structure.
Use realistic, self-contained scenarios. Every question must have exactly four distinct, plausible options and exactly one defensibly correct answer. The correct field is a zero-based integer (0–3).
Supply all constraints, data and assumptions needed to solve each question. Avoid trick wording, trivia, “all/none of the above”, giveaway option length, opinion-only questions and clues to other answers.
Each explanation must justify the correct answer and explain why the alternatives do not meet the scenario's constraints. Vary correct-answer positions.
Cover every supplied topic at least once; spread remaining questions across topics. Each question.topic must use the exact supplied topic label; all learner-facing text must use the requested language. Keep necessary technical identifiers unchanged.
Write unique questions, IDs q1 through qN, a useful title and short learner instructions that do not reveal answers.
Use fictional organizations, people and data only. Never invent Halyk policies, employee facts, internal scoring formulas or legal requirements. No external links are needed.
These are practice tests, not validated employment or promotion decisions. Do not claim a score proves work performance. Do not provide chain-of-thought; provide concise instructional explanations.
Before returning, check question count, topic coverage, factual consistency, unambiguous answer keys and duplicate options.`;

// Exactly one specialized template per skill; shared skills reuse it with role/level parameters.
export function skillTemplate(skillId) {
  const skill = getSkill(skillId);
  if (!skill) throw new Error('Неизвестный навык.');
  return `SKILL: ${skill.title}\nASSESSMENT FOCUS: ${skill.focus}\nTOPICS (exact labels): ${skill.topics.join(' | ')}\nROLE: {{position}}\nROLE CONTEXT: {{roleContext}}\nLEVEL: {{level}}\nDIFFICULTY: {{difficulty}}\nLANGUAGE: {{language}}\nQUESTION COUNT: {{questionCount}}\nGenerate exactly {{questionCount}} questions for this single skill. Passing threshold is configured by the application, not by you.`;
}

export function buildPrompt(input) {
  const config = validateConfig(input);
  const position = getPosition(config.positionId);
  const variables = { position: position.title, roleContext: position.description, level: LEVELS[config.level], difficulty: DIFFICULTY[config.level], language: LANGUAGES[config.language], questionCount: config.questionCount };
  return {
    version: PROMPT_VERSION,
    system: SYSTEM_PROMPT,
    user: skillTemplate(config.skillId).replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key]),
  };
}

export function exportPromptLibrary() {
  return { catalogVersion: CATALOG_VERSION, promptVersion: PROMPT_VERSION, system: SYSTEM_PROMPT, variables: ['position', 'roleContext', 'level', 'difficulty', 'language', 'questionCount'], difficulty: DIFFICULTY, positions: POSITIONS, prompts: SKILLS.map(s => ({ skillId: s.id, title: s.title, source: s.source, template: skillTemplate(s.id) })) };
}
