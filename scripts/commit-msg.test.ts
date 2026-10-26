import { describe, expect, it } from 'vitest';
import { validateCommitMessage } from './commit-msg.ts';

describe('validateCommitMessage', () => {
  it.each([
    'feat: add thing',
    'feat(engine): add analysis queue',
    'fix(ui)!: break api\n\nbody',
    'chore: set up project methodology',
    'Merge branch main into x',
    'feat: x\r\nbody',
  ])('accepts %j', (msg) => {
    expect(validateCommitMessage(msg)).toBeNull();
  });

  it.each(['arreglo cosas', 'Feat: x', 'feat:x', 'feat: ', 'wip: x', 'feat(Bad Scope): x', ''])(
    'rejects %j and explains the format',
    (msg) => {
      expect(validateCommitMessage(msg)).toContain('Formato');
    },
  );

  it('rejects headers over 100 chars', () => {
    expect(validateCommitMessage(`feat: ${'x'.repeat(100)}`)).toContain('100');
  });
});
