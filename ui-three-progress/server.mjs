// Local prototype server with a transient OpenAI adapter. No persistence.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAssessment, GenerationError } from './test-generation/openai.mjs';
import fixtures from './mock-data.json' with { type: 'json' };
import { actorFromCookie, canEditTest } from './growth-model.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/plain' };
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };

export function createServer({ generate = generateAssessment } = {}) {
return http.createServer(async (req, res) => {
  const host = req.headers.host;
  const hosts = [`localhost:${req.socket.localPort}`, `127.0.0.1:${req.socket.localPort}`];
  if (!hosts.includes(host)) { json(res, 403, { error: 'Доступ разрешён только с локального компьютера.' }); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname); }
  catch { json(res, 400, { error: 'Некорректный адрес.' }); return; }
  // Prototype identity only. Production must replace this switchable cookie with
  // an authenticated server session and persisted per-test author assignments.
  const actorId = actorFromCookie(req.headers.cookie);
  if (pathname === '/api/test-access') {
    if (req.method !== 'GET') { json(res, 405, { error: 'Используйте GET.' }); return; }
    json(res, 200, { actor: fixtures.access.users.find(user => user.id === actorId) || fixtures.access.users[0], skills: fixtures.tests.filter(test => canEditTest(fixtures, actorId, test.id)).map(test => test.id) });
    return;
  }
  if (pathname === '/api/generate-test') {
    if (req.method !== 'POST') { json(res, 405, { error: 'Используйте POST.' }); return; }
    if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') { json(res, 403, { error: 'Запрос с другого сайта запрещён.' }); return; }
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') { json(res, 415, { error: 'Ожидается JSON.' }); return; }
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16384) { json(res, 413, { error: 'Запрос слишком большой.' }); return; }
        chunks.push(chunk);
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString()); }
      catch { throw new GenerationError('Некорректный JSON.', 400); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new GenerationError('Некорректный запрос.', 400);
      if (!canEditTest(fixtures, actorId, payload.config?.skillId)) throw new GenerationError('Только назначенный автор может генерировать вопросы для этого теста.', 403);
      const assessment = await generate(payload.config, { apiKey: payload.apiKey, signal: controller.signal });
      if (!res.destroyed) json(res, 200, { assessment });
    } catch (error) {
      if (!res.destroyed) json(res, error instanceof GenerationError ? error.status : 500, { error: error instanceof GenerationError ? error.message : 'Не удалось сгенерировать тест.' });
    }
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/') || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(403).end(); return; }
  try {
    let content = await readFile(file);
    if (extname(file) === '.html') content = content.toString().replace('data-prototype="true"', `data-prototype="${!production}"`);
    res.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end('Not found'); }
});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, '127.0.0.1', () => console.log(`Halyk UI prototype: http://localhost:${port}  (${production ? 'presentation' : 'prototype'} mode)`));
}
