// SessionStart: inject branch, next task, its header and the handoff notes so a fresh/cleared session knows where it is.
import { currentBranch, git, nextTask, roadmap } from './lib.mjs';

const md = roadmap();
const task = nextTask(md);
const handoff = md.match(/## Notas de traspaso[\s\S]*?(?=\n## )/)?.[0].trim() ?? '(sin notas)';
// The task block runs from its heading to the next heading of the same or higher level.
const taskBlock =
  task === '?'
    ? '(marcador ▶ no encontrado en docs/ROADMAP.md: arréglalo antes de seguir)'
    : (md.match(new RegExp(`### ${task.replace('.', '\\.')} [\\s\\S]*?(?=\\n### |\\n## |\\n---)`))?.[0].trim() ??
      '(tarea no encontrada)');
const dirty = git('status --porcelain').split('\n').filter(Boolean).length;

const context = [
  `Rama actual: ${currentBranch() || '(sin git)'}${dirty ? ` · ${dirty} archivo(s) sin commit` : ''}`,
  `▶ Siguiente tarea: ${task}`,
  '',
  taskBlock,
  '',
  handoff,
  '',
  'Recuerda (CLAUDE.md, regla de oro): empieza diciendo a la usuaria cuál es el siguiente paso y, si la tarea pide otro modelo/esfuerzo/advisor, el comando literal.',
].join('\n');

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context } }),
);
