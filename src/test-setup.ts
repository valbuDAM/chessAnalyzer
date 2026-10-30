import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

// jsdom stamps frames with a clock that starts when the environment boots, but chessground compares
// them with performance.now(): without this, every animation lasts as long as that boot took.
const nextFrame = globalThis.requestAnimationFrame;
globalThis.requestAnimationFrame = (callback) => nextFrame(() => callback(performance.now()));
