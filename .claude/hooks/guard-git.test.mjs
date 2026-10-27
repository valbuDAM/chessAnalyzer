// Run: node --test .claude/hooks/  — runs the guard against a throwaway repo on each branch.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const hook = join(import.meta.dirname, 'guard-git.mjs');
const repo = mkdtempSync(join(tmpdir(), 'guard-'));
const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'ignore' });
git('init', '-q', '-b', 'main');
git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
after(() => rmSync(repo, { recursive: true, force: true }));

const blocked = (command) =>
  spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  }).status === 2;

test('on a feature branch', () => {
  git('switch', '-q', '-c', 'feat/t1-main-screen');
  assert.equal(blocked('git push -u origin feat/t1-main-screen'), false);
  assert.equal(blocked('git push --force-with-lease origin feat/t1-main-screen'), false);
  assert.equal(blocked('git commit -m "feat: x"'), false);
  assert.equal(blocked('git status'), false);
  assert.equal(blocked('git push origin main'), true);
  assert.equal(blocked('git push origin HEAD:main'), true);
  assert.equal(blocked('git push --force origin feat/t1-main-screen'), true);
  assert.equal(blocked('git commit --no-verify -m x'), true);
  assert.equal(blocked('git reset --hard HEAD~1'), true);
});

test('on main with history', () => {
  git('switch', '-q', 'main');
  assert.equal(blocked('git commit -m "feat: x"'), true);
  assert.equal(blocked('git push origin feat/x'), true);
  assert.equal(blocked('git pull'), false);
  assert.equal(blocked('git -c user.name=x commit -m y'), true);
  assert.equal(blocked('git status && git commit -m y'), true);
});

test('words in paths or arguments are not git subcommands', () => {
  git('switch', '-q', 'main');
  assert.equal(blocked('cat .claude/hooks/guard-git.mjs scripts/commit-msg.ts'), false);
  assert.equal(blocked('grep -rn push .claude/hooks/guard-git.mjs'), false);
  assert.equal(blocked('git log --grep commit'), false);
});
