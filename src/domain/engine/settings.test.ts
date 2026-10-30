import { describe, expect, it } from 'vitest';
import { analysisSettings, uciOptions } from './settings.ts';

describe('analysisSettings (ADR-009)', () => {
  it.each([
    [
      { variant: 'lite-multi', cores: 8, mobile: false },
      { depth: 16, threads: 4, hashMb: 64 },
    ],
    [
      { variant: 'lite-multi', cores: 4, mobile: false },
      { depth: 16, threads: 3, hashMb: 64 },
    ],
    // A one-core machine still gets one thread, never zero.
    [
      { variant: 'lite-multi', cores: 1, mobile: false },
      { depth: 16, threads: 1, hashMb: 64 },
    ],
    [
      { variant: 'lite-multi', cores: 8, mobile: true },
      { depth: 12, threads: 4, hashMb: 16 },
    ],
    [
      { variant: 'lite-single', cores: 8, mobile: false },
      { depth: 12, threads: 1, hashMb: 64 },
    ],
    [
      { variant: 'asm', cores: 8, mobile: true },
      { depth: 12, threads: 1, hashMb: 16 },
    ],
  ] as const)('%j → %j', (env, expected) => {
    expect(analysisSettings(env)).toEqual({ ...expected, multiPv: 2 });
  });
});

describe('uciOptions', () => {
  it('maps the settings to UCI options and leaves out a single thread', () => {
    expect(uciOptions({ depth: 16, threads: 4, hashMb: 64, multiPv: 2 })).toEqual({ Threads: 4, Hash: 64, MultiPV: 2 });
    expect(uciOptions({ depth: 12, threads: 1, hashMb: 16, multiPv: 2 })).toEqual({ Hash: 16, MultiPV: 2 });
  });
});
