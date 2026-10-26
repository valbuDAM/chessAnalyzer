// Shared helpers for hook scripts. Node stdlib only.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

export function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

// Unborn repos (no commits yet) report no branch via rev-parse, so fall back to symbolic-ref.
export const currentBranch = () => git('symbolic-ref --short HEAD') || git('rev-parse --abbrev-ref HEAD');

export function roadmap() {
  try {
    return readFileSync(join(root, 'docs', 'ROADMAP.md'), 'utf8');
  } catch {
    return '';
  }
}

export const nextTask = (md) => md.match(/▶ Siguiente tarea:\s*(\S+)/)?.[1] ?? '?';
