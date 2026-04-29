import test from 'node:test';
import { assertContains, extractFunctionBody, readRequired } from './helpers.mjs';

test('v1.1 P0 mutations update local state instead of calling loadAll', () => {
  const html = readRequired('index.html');
  for (const functionName of ['saveEntry', 'deleteEntry', 'patchEntry', 'addAnnotation']) {
    const body = extractFunctionBody(html, functionName);
    if (/\bloadAll\s*\(/.test(body)) {
      throw new Error(`${functionName} must update local state and must not call loadAll()`);
    }
    assertContains(body, /setEntries\s*\(/, `${functionName} must update entries state locally`);
  }
});

test('v1.1 P0 saveEntry adds annotation_count=0 and sorts entries', () => {
  const body = extractFunctionBody(readRequired('index.html'), 'saveEntry');
  assertContains(body, /annotation_count\s*:\s*0/, 'new entries must be normalized with annotation_count: 0');
  assertContains(body, /sortEntries\s*\(/, 'new entries must be passed through sortEntries');
});

test('v1.1 P0 patchEntry preserves annotation_count and sorts entries', () => {
  const body = extractFunctionBody(readRequired('index.html'), 'patchEntry');
  assertContains(body, /annotation_count\s*:\s*e\.annotation_count/, 'patched entries must preserve local annotation_count');
  assertContains(body, /sortEntries\s*\(/, 'patched entries must be passed through sortEntries');
});

test('v1.1 P0 addAnnotation increments parent count and returns the new annotation', () => {
  const body = extractFunctionBody(readRequired('index.html'), 'addAnnotation');
  assertContains(body, /annotation_count\s*:\s*\(\s*e\.annotation_count\s*\|\|\s*0\s*\)\s*\+\s*1/, 'addAnnotation must increment annotation_count locally');
  assertContains(body, /return\s+newAnnotation/, 'addAnnotation must return the created annotation to NoteSection');
});

test('v1.1 P0 NoteSection reloads details when local annotations are incomplete', () => {
  const body = extractFunctionBody(readRequired('index.html'), 'toggle');
  assertContains(body, /annotations\.length\s*<\s*entry\.annotation_count/, 'lazy detail loading must compare loaded annotations with annotation_count');
  assertContains(body, /\/entries\/\$\{entry\.id\}/, 'toggle must fetch entry detail when annotations are incomplete');
});

test('v1.1 P0 annotation submit keeps section expanded and appends locally', () => {
  const body = extractFunctionBody(readRequired('index.html'), 'submit');
  assertContains(body, /setExpanded\s*\(\s*true\s*\)/, 'annotation submit must keep the section expanded');
  assertContains(body, /setAnnotations\s*\(\s*prev\s*=>\s*\[\s*\.\.\.prev\s*,\s*newAnnotation\s*\]\s*\)/, 'annotation submit must append the new annotation locally');
});

test('v1.1 P1 date filter is orthogonal to author/pin filter and persisted', () => {
  const html = readRequired('index.html');
  assertContains(html, /dateFilterPass\s*\(/, 'dateFilterPass helper must exist');
  assertContains(html, /notebook\.dateFilter/, 'date filter must use localStorage key notebook.dateFilter');
  assertContains(html, /localStorage\.getItem\s*\(\s*['"]notebook\.dateFilter['"]\s*\)/, 'date filter must initialize from localStorage');
  assertContains(html, /localStorage\.setItem\s*\(\s*['"]notebook\.dateFilter['"]\s*,\s*dateFilter\s*\)/, 'date filter must persist to localStorage');
  assertContains(html, /if\s*\(\s*pass\s*\)\s*pass\s*=\s*dateFilterPass\s*\(\s*e\s*,\s*dateFilter\s*\)/, 'date filter must be applied after author/pin filter so filters stack');
});

test('v1.1 P1 date filter uses natural-day ranges and does not exempt pinned entries', () => {
  const body = extractFunctionBody(readRequired('index.html'), 'dateFilterPass');
  assertContains(body, /setHours\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/, 'date ranges must start from local midnight');
  assertContains(body, /setDate\s*\(\s*cutoff\.getDate\s*\(\s*\)\s*-\s*\(\s*days\s*-\s*1\s*\)\s*\)/, '3d/7d/30d must include today plus prior natural days');
  if (/\bpinned\b/.test(body)) {
    throw new Error('dateFilterPass must not exempt pinned entries from time filtering');
  }
});

test('v1.1 P1 refresh button is in header and filter rows contain only filters', () => {
  const html = readRequired('index.html');
  assertContains(html, /<div\s+className=["']header-top["'][\s\S]*<button\s+onClick=\{loadAll\}>↻<\/button>[\s\S]*<\/div>/, 'refresh button must live in header-top');

  const filtersBlock = html.match(/<div\s+className=["']filters["'][\s\S]*?<\/div>/)?.[0] || '';
  const dateFiltersBlock = html.match(/<div\s+className=["']date-filters["'][\s\S]*?<\/div>/)?.[0] || '';
  if (/↻|loadAll/.test(filtersBlock + dateFiltersBlock)) {
    throw new Error('filter rows must not contain the refresh control');
  }
});

test('v1.1 P1 edit actions use a dedicated right-aligned class', () => {
  const html = readRequired('index.html');
  assertContains(html, /\.edit-actions\s*\{[\s\S]*justify-content\s*:\s*flex-end/i, 'edit-actions must right-align edit mode buttons');
  assertContains(html, /<div\s+className=["']edit-actions["']>/, 'edit mode SAVE/CANCEL buttons must use edit-actions class');
});

test('v1.1 P1 button colors match the requested hierarchy', () => {
  const html = readRequired('index.html');
  assertContains(html, /\.filters\s+button\s*\{[\s\S]*color\s*:\s*#7a8599/i, 'primary filter default color must be #7a8599');
  assertContains(html, /\.date-filters\s+button\s*\{[\s\S]*color\s*:\s*#4a5568/i, 'date filter default color must remain #4a5568');
  assertContains(html, /\.edit-actions\s+button\.primary\s*\{[\s\S]*color\s*:\s*#b89a6a/i, 'edit primary save button must use user gold');
  assertContains(html, /\.annotation-input-row\s+button\.primary\s*\{[\s\S]*color\s*:\s*#b89a6a/i, 'annotation save button must use user gold');
});

test('v1.1 P2 user-facing controls are localized to Chinese while reserved English stays', () => {
  const html = readRequired('index.html');
  for (const text of ['保存', '取消', '编辑', '删除', '置顶', '取消置顶', '连接', '写批注...', '写点什么...', '加载中...', '暂无条目', '条批注', '全部']) {
    assertContains(html, text, `missing localized text: ${text}`);
  }

  for (const reserved of ['NOTEBOOK', 'STANDBY MEMORY BUFFER', 'NON-ARCHIVABLE']) {
    assertContains(html, reserved, `reserved English text should remain: ${reserved}`);
  }
});

test('v1.1 P2 author filters use settings display names with AI/User fallbacks', () => {
  const html = readRequired('index.html');
  assertContains(html, /\{settings\?\.ai_name\s*\|\|\s*['"]AI['"]\}/, 'AI filter must render settings.ai_name with AI fallback');
  assertContains(html, /\{settings\?\.user_name\s*\|\|\s*['"]User['"]\}/, 'User filter must render settings.user_name with User fallback');
});
