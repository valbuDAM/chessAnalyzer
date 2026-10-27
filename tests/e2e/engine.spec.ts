import type { Page } from '@playwright/test';
import { Chess } from 'chessops/chess';
import { parseUci } from 'chessops/util';
import { expect, test } from './fixtures';

const MATE_IN_1 = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';

test.beforeEach(async ({ page }) => {
  await page.goto('/engine-check.html');
});

async function analyse(page: Page, fen: string, depth: number) {
  await page.getByLabel('FEN').fill(fen);
  await page.getByLabel('Profundidad').fill(String(depth));
  await page.getByRole('button', { name: 'Analizar' }).click();
  const result = page.getByRole('status', { name: 'Resultado' });
  await expect(result).toHaveText(/^\{/, { timeout: 60_000 });
  return JSON.parse((await result.textContent()) ?? '');
}

test('start position at depth 10: evaluation within ±100 cp and a legal best move', async ({ page }) => {
  const ticksBefore = Number(await page.getByTestId('ticks').textContent());
  const result = await analyse(page, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 10);

  expect(result.score.kind).toBe('cp');
  expect(Math.abs(result.score.cp)).toBeLessThanOrEqual(100);
  expect(result.depth).toBeGreaterThanOrEqual(10);

  const move = parseUci(result.bestMove);
  const pos = Chess.default();
  expect(move && 'from' in move && pos.dests(move.from).has(move.to)).toBe(true);
  expect(Number(await page.getByTestId('ticks').textContent())).toBeGreaterThan(ticksBefore);
});

test('mate in one: reports mate 1 and the mating move', async ({ page }) => {
  const result = await analyse(page, MATE_IN_1, 10);
  expect(result.score).toEqual({ kind: 'mate', mate: 1 });
  expect(result.bestMove).toBe('a1a8');
});

test('serves the engine wasm as application/wasm', async ({ request }) => {
  const response = await request.get('/engine/stockfish-19-lite-single.wasm');
  expect(response.headers()['content-type']).toContain('application/wasm');
});

test('has no serious a11y violations', async ({ expectNoSeriousA11yViolations }) => {
  await expectNoSeriousA11yViolations();
});
