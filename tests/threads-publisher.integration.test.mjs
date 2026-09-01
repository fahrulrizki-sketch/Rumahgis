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

test('publisher creates root and chained replies against mock Threads API', async (t) => {
  const calls = [];
  let createCounter = 0;
  let publishCounter = 0;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      calls.push({ url: req.url, params: Object.fromEntries(params.entries()) });
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
    THREADS_USER_ID: '123',
    THREADS_ACCESS_TOKEN: 'test-token'
  });

  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.root_id, 'post-1');
  assert.equal(output.published.length, 3);

  const createCalls = calls.filter((c) => c.url.endsWith('/threads'));
  assert.equal(createCalls.length, 3);
  assert.equal(createCalls[0].params.reply_to_id, undefined);
  assert.equal(createCalls[1].params.reply_to_id, 'post-1');
  assert.equal(createCalls[2].params.reply_to_id, 'post-2');
});
