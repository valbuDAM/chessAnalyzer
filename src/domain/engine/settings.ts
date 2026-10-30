import type { Variant } from './variant.ts';

export type AnalysisSettings = { depth: number; threads: number; hashMb: number; multiPv: number };

/** The UCI options for `UciEngine`; `Threads` is left out at 1 (the default), which not every build lists. */
export const uciOptions = ({ threads, hashMb, multiPv }: AnalysisSettings): Record<string, number> => ({
  ...(threads > 1 && { Threads: threads }),
  Hash: hashMb,
  MultiPV: multiPv,
});

/** ADR-009: constants in code, not UI options. Only the multithreaded build can use more than one thread. */
export function analysisSettings({
  variant,
  cores,
  mobile,
}: {
  variant: Variant;
  cores: number;
  mobile: boolean;
}): AnalysisSettings {
  const multi = variant === 'lite-multi';
  return {
    depth: multi && !mobile ? 16 : 12,
    threads: multi ? Math.max(1, Math.min(cores - 1, 4)) : 1,
    hashMb: mobile ? 16 : 64,
    multiPv: 2,
  };
}
