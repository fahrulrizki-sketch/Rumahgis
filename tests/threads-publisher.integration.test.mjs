import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function runNode(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('publisher resolves /me, creates root, and chains replies against mock Threads API', async (t) => {
  const calls = [];
  let createCounter = 0;
  let publishCounter = 0;

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url.startsWith('/v1.0/me?')) {
      calls.push({ url: req.url, method: 'GET', params: {} });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: '123', username: 'rumahgis' }));
      return;
    }

    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      calls.push({ url: req.url, method: req.method, params: Object.fromEntries(params.entries()) });
      res.setHeader('content-type', 'application/json');

      if (req.url === '/v1.0/123/threads') {
        createCounter += 1;
        res.end(JSON.stringify({ id: `container-${createCounter}` }));
        return;
      }
      if (req.url === '/v1.0/123/threads_publish') {
        publishCounter += 1;
        res.end(JSON.stringify({ id: `post-${publishCounter}` }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: 'not found' } }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rumahgis-'));
  const payloadPath = path.join(dir, 'thread.json');
  await fs.writeFile(payloadPath, JSON.stringify({
    main: { text: 'post utama' },
    replies: [{ text: 'reply satu' }, { text: 'reply dua' }]
  }));

  const result = await runNode(['scripts/threads-publisher.mjs', payloadPath, '--publish'], {
    THREADS_API_BASE: `http://127.0.0.1:${port}/v1.0`,
    THREADS_USER_ID: '',
    THREADS_ACCESS_TOKEN: 'test-token'
  });

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.user_id, '123');
  assert.equal(output.root_id, 'post-1');
  assert.equal(output.published.length, 3);
  assert.ok(calls.some((c) => c.method === 'GET' && c.url.startsWith('/v1.0/me?')));

  const createCalls = calls.filter((c) => c.url.endsWith('/threads'));
  assert.equal(createCalls.length, 3);
  assert.equal(createCalls[0].params.reply_to_id, undefined);
  assert.equal(createCalls[1].params.reply_to_id, 'post-1');
  assert.equal(createCalls[2].params.reply_to_id, 'post-2');
});

test('publisher injects an approved relevant affiliate link only into the final reply', async (t) => {
  const createCalls = [];
  let counter = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const params = Object.fromEntries(new URLSearchParams(body).entries());
      res.setHeader('content-type', 'application/json');
      if (req.url === '/v1.0/123/threads') {
        createCalls.push(params);
        counter += 1;
        res.end(JSON.stringify({ id: `container-${counter}` }));
        return;
      }
      if (req.url === '/v1.0/123/threads_publish') {
        res.end(JSON.stringify({ id: `post-${counter}` }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: 'not found' } }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rumahgis-affiliate-'));
  const payloadPath = path.join(dir, 'thread.json');
  const bankPath = path.join(dir, 'products.json');
  await fs.writeFile(payloadPath, JSON.stringify({
    main: { text: 'Panduan perjalanan saat musim hujan.' },
    replies: [{ text: 'Cek prakiraan sebelum berangkat.' }],
    affiliate: { mode: 'auto' },
  }));
  await fs.writeFile(bankPath, JSON.stringify({ products: [{
    id: 'jas-hujan-01',
    title: 'Jas hujan perjalanan',
    relevance_keywords: ['musim hujan'],
    short_url: 'https://s.shopee.co.id/abc123',
    status: 'active',
    approved_for_auto_publish: true,
  }] }));

  const result = await runNode(['scripts/threads-publisher.mjs', payloadPath, '--publish'], {
    THREADS_API_BASE: `http://127.0.0.1:${port}/v1.0`,
    THREADS_USER_ID: '123',
    THREADS_ACCESS_TOKEN: 'test-token',
    AFFILIATE_PRODUCT_BANK: bankPath,
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(createCalls.length, 2);
  assert.doesNotMatch(createCalls[0].text, /shopee/i);
  assert.match(createCalls[1].text, /Tautan affiliate/);
  assert.match(createCalls[1].text, /https:\/\/s\.shopee\.co\.id\/abc123/);
  assert.equal(JSON.parse(result.stdout).affiliate.decision, 'YES');
});

test('publisher retries the same container when Threads reports media not ready', async (t) => {
  let publishAttempts = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/v1.0/123/threads') {
        res.end(JSON.stringify({ id: 'container-delayed' }));
        return;
      }
      if (req.url === '/v1.0/123/threads_publish') {
        publishAttempts += 1;
        if (publishAttempts === 1) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: {
            message: 'The requested resource does not exist',
            code: 24,
            error_subcode: 4279009,
          } }));
          return;
        }
        res.end(JSON.stringify({ id: 'post-after-settle' }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { message: 'not found' } }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rumahgis-media-ready-'));
  const payloadPath = path.join(dir, 'thread.json');
  await fs.writeFile(payloadPath, JSON.stringify({ main: { text: 'post uji retry' }, replies: [] }));

  const result = await runNode(['scripts/threads-publisher.mjs', payloadPath, '--publish'], {
    THREADS_API_BASE: `http://127.0.0.1:${port}/v1.0`,
    THREADS_USER_ID: '123',
    THREADS_ACCESS_TOKEN: 'test-token',
    THREADS_RETRY_DELAY_MS: '5',
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(publishAttempts, 2);
  assert.equal(JSON.parse(result.stdout).root_id, 'post-after-settle');
});
