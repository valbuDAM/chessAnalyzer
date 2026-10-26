// Commit-msg hook: rejects messages that are not Conventional Commits. Run by simple-git-hooks.
import { readFileSync } from 'node:fs';

const HEADER = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: \S.*$/;
const MAX_HEADER = 100;

export function validateCommitMessage(message: string): string | null {
  const header = message.split(/\r?\n/)[0] ?? '';
  if (header.startsWith('Merge ') || header.startsWith('Revert "')) return null;
  if (!HEADER.test(header)) {
    return `Mensaje de commit no válido: "${header}"\nFormato: tipo(ámbito opcional): descripción\nTipos: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert\nEjemplo: feat(engine): add analysis queue`;
  }
  return header.length > MAX_HEADER ? `La primera línea supera ${MAX_HEADER} caracteres.` : null;
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: commit-msg.ts <message-file>');
  const error = validateCommitMessage(readFileSync(file, 'utf8'));
  if (error) {
    console.error(error);
    process.exit(1);
  }
}
