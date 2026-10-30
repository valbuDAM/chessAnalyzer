import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

const game = {
  url: 'https://www.chess.com/game/live/200000001',
  pgn: '[Event "Live Chess"]\n[White "ana"]\n[Black "luis"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
  time_control: '180',
  time_class: 'blitz',
  rules: 'chess',
  rated: true,
  end_time: 1709300000,
  white: { username: 'ana', rating: 1500, result: 'checkmated' },
  black: { username: 'luis', rating: 1510, result: 'win' },
};

// On narrow screens the move list starts folded.
async function openMoves(page: Page) {
  const panel = page.locator('details.game-viewer-moves');
  if ((await panel.getAttribute('open')) === null) await panel.getByText('Jugadas', { exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.chess.com/pub/player/ana', (r) => r.fulfill({ json: { username: 'ana' } }));
  await page.route('https://api.chess.com/pub/player/ana/games/archives', (r) =>
    r.fulfill({ json: { archives: ['https://api.chess.com/pub/player/ana/games/2024/03'] } }),
  );
  await page.route('https://api.chess.com/pub/player/ana/games/2024/**', (r) => r.fulfill({ json: { games: [game] } }));
});

test('the move list scrolls itself, not the page, to keep the current move in view', async ({ page }) => {
  const pgn = `[White "ana"]\n[Black "luis"]\n\n${
    '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 ' +
    '11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. a4 c5 16. d5 c4 17. Bg5 h6 18. Bd2 Qc7 *'
  }`;
  await page.route('https://api.chess.com/pub/player/ana/games/2024/**', (r) =>
    r.fulfill({ json: { games: [{ ...game, pgn }] } }),
  );
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await page.getByRole('link', { name: /luis/ }).click();

  const list = page.getByRole('list', { name: 'Jugadas' });
  const next = page.getByRole('button', { name: 'Siguiente' });
  for (let i = 0; i < 36; i++) await next.click();
  await openMoves(page); // folded on narrow screens: opening must show the current move

  // The scroll happens on the next frame, so poll for it.
  await expect
    .poll(async () => {
      const [box, last] = await Promise.all([list.boundingBox(), list.getByRole('button').last().boundingBox()]);
      return (
        (last?.y ?? Infinity) >= (box?.y ?? Infinity) &&
        (last?.y ?? Infinity) + (last?.height ?? 0) <= (box?.y ?? 0) + (box?.height ?? 0) + 1
      );
    })
    .toBe(true);
});

test('user → list → game → analysis with the real engine', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await page.getByRole('link', { name: /luis/ }).click();
  await expect(page.getByRole('heading', { name: 'ana contra luis' })).toBeVisible();

  await page.getByRole('button', { name: 'Analizar' }).click();
  await openMoves(page);

  const moves = page.getByRole('list', { name: 'Jugadas' }).getByRole('button');
  await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0, { timeout: 60_000 });
  // After 2.g4 black plays Qh4#: mate in 1 for black, seen from white; the final position is a finished game.
  await expect(moves.nth(2)).toContainText('-#1');
  await expect(moves.nth(3)).toContainText('0-1');

  await expect(page.getByRole('meter', { name: 'Ventaja de las blancas' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(moves.nth(0)).toHaveAttribute('aria-current', 'step');
  await moves.nth(2).click(); // 2.g4
  await expect(page.getByRole('status')).toContainText('Jugada 3 de 4');
  await expect(moves.nth(2)).toHaveAttribute('aria-current', 'step');
  await expectNoSeriousA11yViolations();
});

test('the game can be walked with the keyboard alone', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await page.getByRole('link', { name: /luis/ }).click();

  await expect(page.getByRole('heading', { name: 'ana contra luis' })).toBeVisible();
  await openMoves(page);
  const status = page.getByRole('status');
  const moves = page.getByRole('list', { name: 'Jugadas' }).getByRole('button');
  await page.keyboard.press('ArrowRight');
  await expect(status).toContainText('1. f3, blancas');
  await expect(moves.nth(0)).toHaveAttribute('aria-current', 'step');
  await page.keyboard.press('End');
  await expect(status).toContainText('2. Dh4#, negras');
  await page.keyboard.press('Home');
  await expect(status).toContainText('Posición inicial');

  await page.keyboard.press('f');
  await expect(page.getByRole('button', { name: 'Girar tablero' })).toHaveAttribute('aria-pressed', 'true');
  await expectNoSeriousA11yViolations();
});

async function openGame(page: Page) {
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('ana');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await page.getByRole('link', { name: /luis/ }).click();
  await expect(page.getByRole('heading', { name: 'ana contra luis' })).toBeVisible();
}

// `delete window.X` is silently ignored on the mobile (Pixel 7) project; redefining the property is not.
const hideGlobal = (name: string) => `Object.defineProperty(window, '${name}', { value: undefined });`;

// Each branch of the fallback chain (ADR-008): which Worker script is requested proves which build was picked.
const branches = [
  { name: 'multi-thread when the page is isolated', script: /\/stockfish-19-lite\.js/, text: 'multihilo', hide: '' },
  {
    name: 'single thread without SharedArrayBuffer',
    script: /\/stockfish-19-lite-single\.js/,
    text: 'un hilo',
    hide: hideGlobal('SharedArrayBuffer'),
  },
  {
    name: 'asm.js without WebAssembly',
    script: /\/stockfish-19-asm\.js/,
    text: 'sin WebAssembly',
    hide: hideGlobal('WebAssembly'),
  },
];

for (const { name, script, text, hide } of branches) {
  test(`engine variant: ${name}`, async ({ page }) => {
    await page.addInitScript(hide);
    await openGame(page);
    const requested = page.waitForRequest(script);

    await page.getByRole('button', { name: 'Analizar' }).click();
    await requested;

    await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('details.game-viewer-about')).toContainText(text);
  });
}

test('a game analysed once reopens analysed after a reload, without starting the engine', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0, { timeout: 60_000 });
  // The save is not awaited by the page: give it a moment before leaving.
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('keyval-store');
        open.onsuccess = () => {
          const keys = open.result.transaction('keyval').objectStore('keyval').getAllKeys();
          keys.onsuccess = () => resolve(keys.result.some((k) => String(k).startsWith('analysis:v1:')));
        };
      }),
  );

  const engineRequests: string[] = [];
  page.on('request', (r) => {
    if (/\/stockfish-19-/.test(r.url())) engineRequests.push(r.url());
  });
  await page.reload();

  await expect(page.getByRole('meter', { name: 'Ventaja de las blancas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0);
  expect(engineRequests).toEqual([]);
});

test('a silent engine ends in "could not load" after 10 s and the game stays walkable', async ({ page }) => {
  test.setTimeout(40_000);
  await page.route('**/engine/stockfish-19-*.js', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      headers: { 'cross-origin-embedder-policy': 'require-corp' },
      body: '',
    }),
  );
  await openGame(page);

  await page.getByRole('button', { name: 'Analizar' }).click();

  await expect(page.getByRole('alert')).toContainText('No se pudo cargar el motor', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('status')).toContainText('Jugada 1 de 4');
});

test('walking a 300-ply game while it is analysed leaves no long tasks on the main thread', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'the Long Tasks API is Chromium-only');
  // Knights shuffling out and back: 75 cycles of 4 plies, all legal.
  const cycles = Array.from({ length: 75 }, (_, i) => `${2 * i + 1}. Nf3 Nf6 ${2 * i + 2}. Ng1 Ng8`).join(' ');
  const pgn = `[White "ana"]\n[Black "luis"]\n\n${cycles} *`;
  await page.route('https://api.chess.com/pub/player/ana/games/2024/**', (r) =>
    r.fulfill({ json: { games: [{ ...game, pgn }] } }),
  );
  await openGame(page);
  await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[] };
    w.longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.longTasks.push(e.duration);
    }).observe({ entryTypes: ['longtask'] });
  });

  await page.getByRole('button', { name: 'Analizar' }).click();
  for (let i = 0; i < 100; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('status')).toContainText('Jugada 100 de 300');

  // shortcut: the API only reports tasks over 50 ms and a shared CI runner jitters by ~5 ms around that, so the bar is 100 ms; tighten if runners get quieter.
  const longTasks = await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks);
  expect(longTasks.filter((d) => d > 100)).toEqual([]);
});

test('with unpkg down, the deep mode says so and the analysis goes on with lite', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'the deep mode is not offered on touch devices');
  await page.route('https://unpkg.com/**', (r) => r.abort());
  await openGame(page);

  await page.getByText('Acerca del análisis').click();
  await page.getByRole('button', { name: 'Descargar y activar' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo descargar');

  await page.getByRole('button', { name: 'Analizar' }).click();
  await expect(page.getByRole('button', { name: 'Analizar' })).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByText('Stockfish 19 lite, multihilo')).toBeVisible();
});
