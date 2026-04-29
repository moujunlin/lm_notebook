import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rootPath } from './helpers.mjs';

const requiredFiles = [
  'index.html',
  'supabase/setup.sql',
  'supabase/edge-function.ts',
  'CLAUDE_INSTRUCTIONS.md'
];

for (const file of requiredFiles) {
  test(`required file exists: ${file}`, () => {
    assert.equal(fs.existsSync(rootPath(...file.split('/'))), true);
  });
}

