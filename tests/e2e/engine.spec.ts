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

test('stop aborts a deep search at once and the next analysis is not contaminated by it', async ({ page }) => {
  const result = page.getByRole('status', { name: 'Resultado' });
  await page.getByLabel('FEN').fill('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  await page.getByLabel('Profundidad').fill('30');
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(result).toHaveText('Analizando…');

  await page.getByRole('button', { name: 'Detener' }).click();
  await expect(result).toHaveText('AbortError: Analysis aborted', { timeout: 5_000 });

  // Same engine, a quick search whose answer must be its own: mate in one, not the leftovers of depth 30.
  const next = await analyse(page, MATE_IN_1, 5);
  expect(next.score).toEqual({ kind: 'mate', mate: 1 });
  expect(next.bestMove).toBe('a1a8');
});

test('configures the engine: MultiPV 2 and a hash (ADR-009) before the first search', async ({ page }) => {
  await page.addInitScript(() => {
    const sent: string[] = [];
    Object.assign(window, { sent });
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (this: Worker, message: unknown, ...rest: never[]) {
      if (typeof message === 'string') sent.push(message);
      return post.call(this, message, ...rest);
    } as typeof post;
  });
  await page.goto('/engine-check.html');
  await analyse(page, MATE_IN_1, 5);

  const sent: string[] = await page.evaluate(() => (window as unknown as { sent: string[] }).sent);
  expect(sent).toContain('setoption name MultiPV value 2');
  expect(sent.some((c) => /^setoption name Hash value (16|64)$/.test(c))).toBe(true); // 16 on the touch project
  expect(sent.findIndex((c) => c.startsWith('setoption'))).toBeLessThan(sent.findIndex((c) => c.startsWith('go')));
});

test('serves each engine wasm as application/wasm', async ({ request }) => {
  for (const file of ['stockfish-19-lite-single.wasm', 'stockfish-19-lite.wasm']) {
    const response = await request.get(`/engine/${file}`);
    expect(response.headers()['content-type']).toContain('application/wasm');
  }
});

test('has no serious a11y violations', async ({ expectNoSeriousA11yViolations }) => {
  await expectNoSeriousA11yViolations();
});
