// PostToolUse (Edit|Write|MultiEdit): format the touched file with Biome. Silent no-op until Biome is installed (T0.1).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readStdinJson, root } from './lib.mjs';

const file = readStdinJson().tool_input?.file_path;
const biome = join(root, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
if (file && /\.(m?[jt]sx?|json|css)$/.test(file) && existsSync(biome)) {
  try {
    execFileSync(process.execPath, [biome, 'format', '--write', file], { cwd: root, stdio: 'ignore' });
  } catch {
    // Unparseable mid-edit file: lint/typecheck will report it; never block an edit on formatting.
  }
}
