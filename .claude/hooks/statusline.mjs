// statusLine: model · context % · 5h plan usage % · next task · branch. Warns when it's time to /compact.
import { currentBranch, nextTask, readStdinJson, roadmap } from './lib.mjs';

const s = readStdinJson();
const ctx = Math.round(s.context_window?.used_percentage ?? 0);
const five = s.rate_limits?.five_hour?.used_percentage;
const parts = [
  s.model?.display_name ?? '?',
  `ctx ${ctx}%${ctx >= 60 ? ' ⚠ /compact' : ''}`,
  five == null ? null : `5h ${Math.round(five)}%`,
  `▶ ${nextTask(roadmap())}`,
  currentBranch(),
];
process.stdout.write(parts.filter(Boolean).join(' · '));
