import archives from '../fixtures/chesscom/archives.json' with { type: 'json' };
import month from '../fixtures/chesscom/month.json' with { type: 'json' };
import { expect, test } from './fixtures';

const API = 'https://api.chess.com/pub/player/hikaru';
// Each month gets its own games; 2024/01 repeats one of 2024/03 to check it is not listed twice.
// The fixture's second game has no PGN on purpose (the domain drops it), so every game here derives from the first.
const [first] = month.games;
const second = {
  ...first,
  url: 'https://www.chess.com/game/live/100000002',
  end_time: 1709300500,
  white: { username: 'magnus', rating: 3100, result: 'checkmated' },
  black: { username: 'hikaru', rating: 3210, result: 'win' },
};
const games: Record<string, unknown[]> = {
  '2024/03': [first, second],
  '2024/01': [second, { ...first, url: 'https://www.chess.com/game/live/100000003', end_time: 1704100000 }],
  '2023/12': [{ ...first, url: 'https://www.chess.com/game/live/100000004', end_time: 1701500000 }],
};

test.beforeEach(async ({ page }) => {
  await page.route(API, (r) => r.fulfill({ json: { username: 'hikaru' } }));
  await page.route('https://api.chess.com/pub/player/usuario_que_no_existe_123', (r) => r.fulfill({ status: 404 }));
  await page.route(`${API}/games/archives`, (r) => r.fulfill({ json: archives }));
  for (const [m, list] of Object.entries(games)) {
    await page.route(`${API}/games/${m}`, (r) => r.fulfill({ json: { games: list } }));
  }
});

const cards = (page: import('@playwright/test').Page) => page.getByRole('list').getByRole('link');

test('home page renders and has no serious a11y violations', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Zugzwang' })).toBeVisible();
  await expectNoSeriousA11yViolations();
});

test('submitting a user lists their newest month', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  await page.getByLabel('Usuario de chess.com').fill('hikaru');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await expect(page).toHaveURL('/u/hikaru');
  await expect(page.getByRole('heading', { name: 'marzo de 2024' })).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  await expectNoSeriousA11yViolations();
});

test('earlier months append in order without duplicates, and survive a trip to a game', async ({
  page,
  expectNoSeriousA11yViolations,
}) => {
  await page.goto('/u/hikaru');
  const more = page.getByRole('button', { name: 'Cargar mes anterior' });
  await more.click();
  await expect(page.getByRole('heading', { name: 'enero de 2024' })).toBeFocused();
  await more.click();
  await expect(page.getByRole('heading', { name: 'diciembre de 2023' })).toBeVisible();
  await expect(more).toHaveCount(0);
  await expect(page).toHaveURL('/u/hikaru?months=3');
  const ids = await cards(page).evaluateAll((links) => links.map((a) => a.getAttribute('href')?.split('?')[0]));
  expect(ids).toEqual(['/u/hikaru/100000002', '/u/hikaru/100000001', '/u/hikaru/100000003', '/u/hikaru/100000004']);
  await expectNoSeriousA11yViolations();

  // Keyboard: focus the first card and open it with Enter.
  await cards(page).first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/u/hikaru/100000002?months=3');
  await expect(page.getByRole('heading', { name: 'magnus contra hikaru' })).toBeVisible();
  // hikaru played black here, so the board shows black at the bottom.
  await expect(page.getByRole('img', { name: 'Tablero de la partida' })).toHaveClass(/orientation-black/);
  await expectNoSeriousA11yViolations();

  await page.goBack();
  await expect(cards(page)).toHaveCount(4);

  // The page's own back link keeps the months too.
  await cards(page).first().click();
  await page.getByRole('link', { name: 'Volver a sus partidas' }).click();
  await expect(page).toHaveURL('/u/hikaru?months=3');
  await expect(cards(page)).toHaveCount(4);
});

test('a broken game link says so and leads back to the list', async ({ page }) => {
  await page.goto('/u/hikaru/999');
  await expect(page.getByRole('alert')).toContainText('No hay ninguna partida con ese enlace');
  await page.getByRole('link', { name: 'Volver a sus partidas' }).click();
  await expect(page).toHaveURL('/u/hikaru');
});

test('an unknown user shows an error and keeps the typed text', async ({ page, expectNoSeriousA11yViolations }) => {
  await page.goto('/');
  const input = page.getByLabel('Usuario de chess.com');
  await input.fill('usuario_que_no_existe_123');
  await page.getByRole('button', { name: 'Ver partidas' }).click();
  await expect(page.getByRole('alert')).toHaveText('No existe ese usuario en chess.com.');
  await expect(input).toHaveValue('usuario_que_no_existe_123');
  await expectNoSeriousA11yViolations();
});

test('a closed month is downloaded only once, even after a reload', async ({ page }) => {
  let requests = 0;
  await page.route(`${API}/games/2024/03`, (r) => {
    requests++;
    return r.fulfill({ json: month });
  });
  await page.goto('/u/hikaru');
  await expect(page.getByText('MagnusCarlsen')).toBeVisible();
  await page.reload();
  await expect(page.getByText('MagnusCarlsen')).toBeVisible();
  expect(requests).toBe(1);
});

test('filters narrow the list, show an empty state, and survive a trip to a game', async ({
  page,
  expectNoSeriousA11yViolations,
}) => {
  await page.goto('/u/hikaru');
  await page.getByLabel('Color').selectOption('black');
  await expect(page).toHaveURL('/u/hikaru?color=black');
  await expect(cards(page)).toHaveCount(1);
  await expect(page.getByText('1 de 2 partidas')).toBeVisible();
  await expectNoSeriousA11yViolations();

  // Back from a game restores the same filtered list.
  await cards(page).first().click();
  await expect(page).toHaveURL('/u/hikaru/100000002?color=black');
  await page.goBack();
  await expect(page.getByLabel('Color')).toHaveValue('black');
  await expect(cards(page)).toHaveCount(1);

  await page.getByLabel('Resultado').selectOption('loss');
  await expect(page.getByText('Ninguna partida cumple estos filtros.')).toBeVisible();
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page).toHaveURL('/u/hikaru');
});

test('picking a month loads only that month and keeps going backwards from it', async ({ page }) => {
  await page.goto('/u/hikaru');
  await page.getByLabel('Mes').focus(); // selectOption alone does not focus
  await page.getByLabel('Mes').selectOption('2024-01');
  await expect(page.getByLabel('Mes')).toBeFocused();
  await expect(page).toHaveURL('/u/hikaru?month=2024-01');
  await expect(page.getByRole('heading', { name: 'enero de 2024' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'marzo de 2024' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cargar mes anterior' }).click();
  await expect(page.getByRole('heading', { name: 'diciembre de 2023' })).toBeVisible();
  await expect(page).toHaveURL('/u/hikaru?month=2024-01&months=2');
});
