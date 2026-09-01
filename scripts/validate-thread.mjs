#!/usr/bin/env node
import fs from 'node:fs/promises';
import { validateThread } from './thread-schema.mjs';

const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!fileArg) {
  console.error('Usage: node scripts/validate-thread.mjs <post.json>');
  process.exit(2);
}

try {
  const raw = await fs.readFile(fileArg, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.replies)) data.replies = [];
  const errors = validateThread(data);
  if (errors.length) {
    console.error(JSON.stringify({ valid: false, errors }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    valid: true,
    main_chars: [...data.main.text].length,
    reply_count: data.replies.length,
    replies: data.replies.map((r, i) => ({ index: i + 1, chars: [...r.text].length }))
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
  process.exit(1);
}
