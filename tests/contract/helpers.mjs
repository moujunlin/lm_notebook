import fs from 'node:fs';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '..', '..');

export function rootPath(...parts) {
  return path.join(repoRoot, ...parts);
}

export function readRequired(relativePath) {
  const absolutePath = rootPath(...relativePath.split('/'));
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

export function assertContains(text, pattern, message) {
  if (pattern instanceof RegExp) {
    if (!pattern.test(text)) throw new Error(message);
    return;
  }
  if (!text.includes(pattern)) throw new Error(message);
}

export function extractFunctionBody(source, functionName) {
  const signature = new RegExp(`async\\s+function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{|function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`);
  const match = signature.exec(source);
  if (!match) throw new Error(`Missing function: ${functionName}`);

  let depth = 1;
  let i = match.index + match[0].length;
  const start = i;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    i += 1;
  }
  if (depth !== 0) throw new Error(`Could not parse function body: ${functionName}`);
  return source.slice(start, i - 1);
}
