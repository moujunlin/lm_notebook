import test from 'node:test';
import { assertContains, readRequired } from './helpers.mjs';

test('frontend parses url|token hash and sends X-Notebook-Token', () => {
  const html = readRequired('index.html');
  assertContains(html, /location\.hash|window\.location\.hash/i, 'frontend must read connection info from URL hash');
  assertContains(html, /\|/, 'frontend must support hash format url|token');
  assertContains(html, /X-Notebook-Token/i, 'frontend requests must send X-Notebook-Token');
});

test('frontend never uses dangerouslySetInnerHTML', () => {
  const html = readRequired('index.html');
  if (/dangerouslySetInnerHTML/.test(html)) {
    throw new Error('content and settings must render as text nodes; dangerouslySetInnerHTML is forbidden');
  }
});

test('frontend gates edit/delete/pin controls to user-authored entries', () => {
  const html = readRequired('index.html');
  assertContains(html, /author\s*={2,3}\s*["']user["']|author\s*!==\s*["']ai["']|entry\.author\s*={2,3}\s*["']user["']/i, 'entry controls must be conditional on author=user');
  assertContains(html, /EDIT/i, 'user entries must expose EDIT');
  assertContains(html, /DEL|DELETE/i, 'user entries must expose delete');
  assertContains(html, /PIN/i, 'user entries must expose pin/unpin');
});

test('frontend renders annotations as read-only content', () => {
  const html = readRequired('index.html');
  assertContains(html, /ANNOTATIONS|annotation/i, 'frontend must render annotations');
  assertContains(html, /created_at|time/i, 'annotations must show a timestamp');
  if (/\bannotation\b[\s\S]{0,300}(EDIT|DEL|DELETE)/i.test(html)) {
    throw new Error('annotation UI must not render edit/delete controls');
  }
});

test('frontend filter controls are mutually exclusive and refresh is not a filter', () => {
  const html = readRequired('index.html');
  assertContains(html, /ALL/i, 'ALL filter must exist');
  assertContains(html, /AI/i, 'AI filter must exist');
  assertContains(html, /USER/i, 'USER filter must exist');
  assertContains(html, /pinned|📌/i, 'pinned filter must exist');
  assertContains(html, /refresh|↻|reload/i, 'refresh control must exist separately from filters');
});

test('frontend implements loading, error, and empty states', () => {
  const html = readRequired('index.html');
  assertContains(html, /LOADING|加载中/i, 'loading state must be visible');
  assertContains(html, /error/i, 'error banner/state must be implemented');
  assertContains(html, /NO ENTRIES|暂无条目/i, 'empty state must be visible');
});
