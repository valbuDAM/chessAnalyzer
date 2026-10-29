import { afterEach, expect, it, vi } from 'vitest';
import { readMuted, soundKind, storeMuted } from './sound.ts';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('picks the sound from the SAN: end beats check beats capture beats a plain move', () => {
  expect(soundKind('e4', false)).toBe('move');
  expect(soundKind('Nxf3', false)).toBe('capture');
  expect(soundKind('Qxf7+', false)).toBe('check');
  expect(soundKind('Qxf7#', false)).toBe('check');
  expect(soundKind('Qxf7#', true)).toBe('end');
  expect(soundKind('e4', true)).toBe('end');
});

it('starts unmuted, and keeps what was stored', () => {
  expect(readMuted()).toBe(false);
  storeMuted(true);
  expect(readMuted()).toBe(true);
  storeMuted(false);
  expect(readMuted()).toBe(false);
});

it('starts muted with reduced motion until the user chooses otherwise', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  expect(readMuted()).toBe(true);
  storeMuted(false);
  expect(readMuted()).toBe(false);
});
