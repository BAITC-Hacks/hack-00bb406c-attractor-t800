// Server-side transport only. Domain modules contain no HTTP/UI dependencies.
import { randomUUID } from 'node:crypto';
import { buildPrompt, validateConfig, PROMPT_VERSION, PASS_SCORE } from './prompts.mjs';
import { assessmentSchema, validateAssessment, shuffleOptions } from './assessment.mjs';

export class GenerationError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export async function generateAssessment(input, { apiKey, fetchImpl = fetch, signal, timeoutMs = 120000 } = {}) {
  let config;
  try { config = validateConfig(input); } catch (error) { throw new GenerationError(error.message, 400); }
  if (typeof apiKey !== 'string' || !/^sk-[a-zA-Z0-9_-]{10,500}$/.test(apiKey)) throw new GenerationError('Введите корректный OpenAI API key.', 400);
  const prompt = buildPrompt(config);
  const requestSignal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', signal: requestSignal,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model, store: false, instructions: prompt.system, input: prompt.user,
        max_output_tokens: Math.max(5000, config.questionCount * 700),
        text: { format: { type: 'json_schema', name: 'skill_assessment', strict: true, schema: assessmentSchema(config) } },
      }),
    });
    if (!response.ok) {
      // Never relay raw provider errors: they can contain credentials or request text.
      const errors = {
        400: 'Модель не поддерживает параметры генерации. Проверьте имя модели и поддержку Structured Outputs.',
        401: 'OpenAI отклонил ключ. Проверьте его и попробуйте снова.',
        403: 'У ключа нет доступа к этой модели или проекту.',
        404: 'Модель не найдена или недоступна вашему проекту.',
        429: 'Достигнут лимит OpenAI или исчерпана квота. Проверьте баланс и повторите позже.',
      };
      throw new GenerationError(errors[response.status] || 'OpenAI временно недоступен. Попробуйте позже.', response.status < 500 ? response.status : 502);
    }
    const body = await response.json();
    const content = (body.output || []).filter(item => item.type === 'message').flatMap(item => item.content || []);
    if (content.some(item => item.type === 'refusal')) throw new GenerationError('Модель отказалась создавать этот тест. Попробуйте другой навык.');
    if (body.status !== 'completed') throw new GenerationError('OpenAI не завершил генерацию. Попробуйте меньше вопросов или другую модель.');
    const raw = content.filter(item => item.type === 'output_text').map(item => item.text).join('');
    let assessment;
    try { assessment = validateAssessment(JSON.parse(raw), config); }
    catch { throw new GenerationError('Модель вернула некорректный тест. Попробуйте сгенерировать заново.'); }
    return { id: randomUUID(), createdAt: new Date().toISOString(), promptVersion: PROMPT_VERSION, config, passScore: PASS_SCORE, ...shuffleOptions(assessment) };
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (requestSignal.aborted) throw new GenerationError(signal?.aborted ? 'Генерация отменена.' : 'Время ожидания истекло. Попробуйте меньше вопросов.', 408);
    throw new GenerationError('Не удалось связаться с OpenAI. Проверьте подключение и повторите.');
  }
}
