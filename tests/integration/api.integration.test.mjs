import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.NOTEBOOK_API_URL;
const token = process.env.NOTEBOOK_API_TOKEN;
const hasLiveConfig = Boolean(baseUrl && token);

function liveTest(name, fn) {
  test(name, { skip: hasLiveConfig ? false : 'Set NOTEBOOK_API_URL and NOTEBOOK_API_TOKEN to run live API tests' }, fn);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');
  if (!headers.has('X-Notebook-Token') && token) headers.set('X-Notebook-Token', token);

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

liveTest('OPTIONS preflight allows X-Notebook-Token', async () => {
  const { response } = await request('/entries', {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'X-Notebook-Token, Content-Type'
    }
  });

  assert.ok([200, 204].includes(response.status));
  assert.match(response.headers.get('Access-Control-Allow-Headers') || '', /X-Notebook-Token/i);
});

liveTest('GET /entries rejects missing or bad token and accepts the correct token', async () => {
  const missing = await fetch(`${baseUrl}/entries`);
  assert.equal(missing.status, 401);

  const bad = await fetch(`${baseUrl}/entries`, { headers: { 'X-Notebook-Token': 'wrong-token' } });
  assert.equal(bad.status, 401);

  const good = await request('/entries');
  assert.equal(good.response.status, 200);
  assert.ok(Array.isArray(good.body));
});

liveTest('POST, PATCH, annotate, and DELETE enforce user-side permissions', async () => {
  const created = await request('/entries', {
    method: 'POST',
    body: JSON.stringify({ author: 'ai', content: `contract-test-${Date.now()}`, pinned: false })
  });
  assert.ok([200, 201].includes(created.response.status));
  assert.equal(created.body.author, 'user');

  const patched = await request(`/entries/${created.body.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ author: 'ai', content: 'contract-test-updated', pinned: true, created_at: '2000-01-01' })
  });
  assert.equal(patched.response.status, 200);
  assert.equal(patched.body.author, 'user');
  assert.equal(patched.body.content, 'contract-test-updated');
  assert.equal(patched.body.pinned, true);

  const annotation = await request(`/entries/${created.body.id}/annotations`, {
    method: 'POST',
    body: JSON.stringify({ author: 'ai', content: 'contract-test-annotation' })
  });
  assert.ok([200, 201].includes(annotation.response.status));
  assert.equal(annotation.body.author, 'user');

  const deleted = await request(`/entries/${created.body.id}`, { method: 'DELETE' });
  assert.ok([200, 204].includes(deleted.response.status));
});

liveTest('POST rejects content over 10KB', async () => {
  const oversized = 'x'.repeat(10241);
  const result = await request('/entries', {
    method: 'POST',
    body: JSON.stringify({ content: oversized, pinned: false })
  });
  assert.equal(result.response.status, 400);
});

liveTest('GET /settings returns defaults when row is missing or settings are unavailable', async () => {
  const result = await request('/settings');
  assert.equal(result.response.status, 200);
  assert.equal(typeof result.body.ai_name, 'string');
  assert.equal(typeof result.body.user_name, 'string');
  assert.equal(typeof result.body.ai_icon, 'string');
  assert.equal(typeof result.body.user_icon, 'string');
});

