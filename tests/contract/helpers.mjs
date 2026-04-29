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

