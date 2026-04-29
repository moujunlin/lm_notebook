import test from 'node:test';
import { assertContains, readRequired } from './helpers.mjs';

test('edge function authenticates non-OPTIONS requests with X-Notebook-Token', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /Deno\.env\.get\s*\(\s*["']NOTEBOOK_API_TOKEN["']\s*\)/, 'NOTEBOOK_API_TOKEN must be read from environment');
  assertContains(source, /headers\.get\s*\(\s*["']X-Notebook-Token["']\s*\)/i, 'X-Notebook-Token header must be read');
  assertContains(source, /Unauthorized/i, 'bad or missing tokens must return Unauthorized');
  assertContains(source, /\b401\b/, 'bad or missing tokens must return HTTP 401');
});

test('edge function CORS allows X-Notebook-Token and skips auth for OPTIONS', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /Access-Control-Allow-Headers[\s\S]+X-Notebook-Token/i, 'CORS allow headers must include X-Notebook-Token');
  assertContains(source, /Access-Control-Allow-Methods[\s\S]+GET[\s\S]+POST[\s\S]+PATCH[\s\S]+DELETE[\s\S]+OPTIONS/i, 'CORS allow methods must include all API verbs');
  assertContains(source, /method\s*={1,3}\s*["']OPTIONS["']|["']OPTIONS["']\s*={1,3}\s*method/i, 'OPTIONS requests must be handled explicitly');
});

test('edge function token comparison is timing-safe and ASCII/TextEncoder aware', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /safeEqual|timing/i, 'a token comparison helper is required');
  assertContains(source, /TextEncoder|ASCII/i, 'safeEqual must either compare encoded bytes or explicitly restrict tokens to ASCII');
});

test('GET /entries returns annotation_count with sorted entries', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /annotation_count/i, 'GET /entries must return annotation_count');
  assertContains(source, /notebook_annotations/i, 'annotation_count must be derived from notebook_annotations');
  assertContains(source, /pinned[\s\S]+desc|ascending\s*:\s*false/i, 'GET /entries must sort pinned DESC');
  assertContains(source, /created_at[\s\S]+desc|ascending\s*:\s*false/i, 'GET /entries must sort created_at DESC');
});

test('GET /settings falls back to defaults when settings row is missing', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /ai_name[\s\S]+Lori|Lori[\s\S]+ai_name/i, 'settings fallback must include ai_name Lori');
  assertContains(source, /user_name[\s\S]+猫猫|猫猫[\s\S]+user_name/i, 'settings fallback must include user_name 猫猫');
  assertContains(source, /ai_icon[\s\S]+user_icon|user_icon[\s\S]+ai_icon/i, 'settings fallback must include icon fields');
});

test('POST /entries ignores supplied author and creates user entries only', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /author\s*:\s*["']user["']|author["']?\s*,\s*["']user["']/i, 'entry creation must force author=user');
  assertContains(source, /content/i, 'entry creation must accept content');
  assertContains(source, /pinned/i, 'entry creation must accept pinned');
});

test('PATCH /entries/:id only updates user-authored entries and whitelists fields', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /select\s*\([\s\S]*author[\s\S]*\)|\.eq\s*\(\s*["']author["']\s*,\s*["']user["']\s*\)/i, 'PATCH must check the existing entry author');
  assertContains(source, /author\s*!==\s*["']user["']|author\s*={2,3}\s*["']user["']|\.eq\s*\(\s*["']author["']\s*,\s*["']user["']\s*\)/i, 'PATCH must reject non-user entries');
  assertContains(source, /\b403\b/, 'PATCH of non-user entries must return 403');
  assertContains(source, /typeof\s+.*content.*===\s*["']string["']/i, 'PATCH must only accept string content');
  assertContains(source, /typeof\s+.*pinned.*===\s*["']boolean["']/i, 'PATCH must only accept boolean pinned');
});

test('DELETE /entries/:id only deletes user-authored entries', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /DELETE/i, 'DELETE route must exist');
  assertContains(source, /author\s*!==\s*["']user["']|author\s*={2,3}\s*["']user["']|\.eq\s*\(\s*["']author["']\s*,\s*["']user["']\s*\)/i, 'DELETE must enforce author=user');
  assertContains(source, /\b403\b/, 'DELETE of non-user entries must return 403');
});

test('POST /entries/:id/annotations ignores supplied author and creates user annotations only', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /notebook_annotations/i, 'annotation creation must write notebook_annotations');
  assertContains(source, /entry_id/i, 'annotation creation must set entry_id from the route');
  assertContains(source, /author\s*:\s*["']user["']|author["']?\s*,\s*["']user["']/i, 'annotation creation must force author=user');
});

test('edge function enforces 10KB content limit before writing', () => {
  const source = readRequired('supabase/edge-function.ts');
  assertContains(source, /10240|10\s*\*\s*1024|10KB/i, 'Edge Function must reject content over 10KB');
  assertContains(source, /\b400\b/, 'content validation failures must return HTTP 400');
});
