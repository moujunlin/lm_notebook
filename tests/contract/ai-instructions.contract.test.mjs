import test from 'node:test';
import { assertContains, readRequired } from './helpers.mjs';

test('AI instructions require author=ai guard on every UPDATE and DELETE', () => {
  const doc = readRequired('CLAUDE_INSTRUCTIONS.md');
  assertContains(doc, /UPDATE[\s\S]+AND\s+author\s*=\s*'ai'/i, 'UPDATE examples must include AND author = ai');
  assertContains(doc, /DELETE[\s\S]+AND\s+author\s*=\s*'ai'/i, 'DELETE examples must include AND author = ai');
  assertContains(doc, /禁止|MUST|must|必须/i, 'instructions must explicitly warn that the author guard is mandatory');
});

test('AI instructions mention backup or irreversible deletion risk', () => {
  const doc = readRequired('CLAUDE_INSTRUCTIONS.md');
  assertContains(doc, /备份|backup|不可恢复|irreversible|破坏数据完整性/i, 'instructions must warn about destructive SQL risk');
});

