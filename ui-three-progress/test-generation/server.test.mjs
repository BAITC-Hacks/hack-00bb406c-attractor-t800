import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer } from '../server.mjs';
import { GenerationError } from './openai.mjs';

async function serverFixture(t, generate) {
  const server = createServer({ generate });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('local generation endpoint passes credentials transiently and returns only assessment', async t => {
  const url = await serverFixture(t, async (config, { apiKey, signal }) => {
    assert.equal(apiKey, 'sk-example');
    assert.deepEqual(config, { skillId: 'architecture' });
    assert.ok(signal instanceof AbortSignal);
    return { id: 'test', questions: [] };
  });
  const response = await fetch(`${url}/api/generate-test`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify({ apiKey: 'sk-example', config: { skillId: 'architecture' } }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { assessment: { id: 'test', questions: [] } });
});

test('reject cross-origin requests, DNS rebinding, non-JSON and invalid bodies before generation', async t => {
  let calls = 0;
  const url = await serverFixture(t, async () => { calls++; });
  for (const [patch, expected] of [
    [{ method: 'GET' }, 405],
    [{ headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' } }, 403],
    [{ headers: { 'Content-Type': 'text/plain' } }, 415],
    [{ body: '{' }, 400],
    [{ body: 'null' }, 400],
    [{ body: 'x'.repeat(17000) }, 413],
  ]) {
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', ...patch };
    if (options.method === 'GET') delete options.body;
    const response = await fetch(`${url}/api/generate-test`, options);
    assert.equal(response.status, expected, JSON.stringify(patch));
    await response.text();
  }
  // Native fetch normalizes Host; use raw HTTP to exercise DNS-rebinding defense.
  const status = await new Promise((resolve, reject) => {
    const req = request(`${url}/api/generate-test`, { method: 'POST', headers: { Host: 'untrusted.example', 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end('{}');
  });
  assert.equal(status, 403);
  assert.equal(calls, 0);
});

test('server preserves safe provider errors and hides unexpected internals', async t => {
  let safe = true;
  const url = await serverFixture(t, async () => { if (safe) throw new GenerationError('Проверьте ключ.', 401); throw new Error('sk-secret'); });
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' };
  let response = await fetch(`${url}/api/generate-test`, options);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Проверьте ключ.' });
  safe = false;
  response = await fetch(`${url}/api/generate-test`, options);
  assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('sk-secret'));
});

test('serves lab and portable ES modules; malformed URL does not crash server', async t => {
  const url = await serverFixture(t);
  for (const path of ['/test-lab.html', '/test-lab.css', '/test-lab.mjs', '/test-generation/catalog.mjs', '/?view=tests']) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    if (path.endsWith('.mjs')) assert.ok(response.headers.get('content-type').startsWith('text/javascript'));
    await response.text();
  }
  assert.equal((await fetch(`${url}/%E0%A4%A`)).status, 400);
  assert.equal((await fetch(`${url}/.env`)).status, 403);
  assert.equal((await fetch(`${url}/test-lab.html`)).status, 200);
});
