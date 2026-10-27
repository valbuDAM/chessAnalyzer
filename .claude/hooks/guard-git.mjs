// PreToolUse (Bash|PowerShell): block git operations that bypass the PR flow. Exit 2 = block, stderr goes to Claude.
import { currentBranch, git, readStdinJson } from './lib.mjs';

const cmd = String(readStdinJson().tool_input?.command ?? '');
const branch = currentBranch();
const hasCommits = git('rev-parse --verify HEAD') !== '';

// `git <sub>` as a command: git starts a word (not guard-git.mjs) and only global options sit before the subcommand,
// so paths like scripts/commit-msg.ts or `git log --grep commit` don't match.
const sub = (name, rest = '') =>
  new RegExp(String.raw`(?:^|[\s;|&(])git(?:\s+-[cC]\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+${name}\b${rest}`);

const rules = [
  // main/master as its own refspec token (` main`, `HEAD:main`), not inside a branch name like feat/t1-main-x.
  [
    sub('push', String.raw`[^\n;|&]*[\s:](main|master)(?=$|[\s;|&])`),
    'push directo a main está prohibido: abre un PR.',
  ],
  [
    sub('push', String.raw`(?![^\n;|&]*--force-with-lease)[^\n;|&]*(--force\b|\s-f\b)`),
    'push --force prohibido (usa --force-with-lease en tu rama si de verdad hace falta).',
  ],
  [/--no-verify\b/, '--no-verify prohibido: arregla lo que falla el hook.'],
  [
    sub('reset', String.raw`[^\n;|&]*--hard\b`),
    'git reset --hard prohibido para Claude: si de verdad hace falta, pídele a la usuaria que lo ejecute ella.',
  ],
];
if (branch === 'main' || branch === 'master') {
  rules.push([sub('push'), `estás en ${branch}: crea una rama feat/txx-slug antes de hacer push.`]);
  // Allowed only for the very first bootstrap commit of an empty repo.
  if (hasCommits) rules.push([sub('commit'), `estás en ${branch}: crea una rama feat/txx-slug antes de hacer commit.`]);
}

const hit = rules.find(([re]) => re.test(cmd));
if (hit) {
  process.stderr.write(`Bloqueado por .claude/hooks/guard-git.mjs: ${hit[1]}`);
  process.exit(2);
}
