import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import '../i18n/index.ts';
import { PastePgn } from './PastePgn.tsx';

const GOOD = '[White "ana"]\n[Black "luis"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 1-0';
const BAD =
  '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Qe5 *';

function setup(text: string) {
  const { hook, history } = memoryLocation({ path: '/', record: true });
  render(
    <Router hook={hook}>
      <PastePgn />
    </Router>,
  );
  fireEvent.change(screen.getByLabelText('O pega un PGN'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^Analizar/ }));
  return history;
}

beforeEach(() => sessionStorage.clear());

it('says which move is illegal and does not open the board', () => {
  const history = setup(BAD);
  expect(screen.getByRole('alert')).toHaveTextContent('Jugada ilegal en 12. Qe5');
  expect(history).toEqual(['/']);
});

it('refuses a variant, naming it, and does not open the board', () => {
  const history = setup(`[Variant "Chess960"]\n\n1. e4 e5 *`);
  expect(screen.getByRole('alert')).toHaveTextContent('Chess960');
  expect(history).toEqual(['/']);
});

it('says so when there is no game', () => {
  setup('hola');
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

it('opens a single game straight away', () => {
  const history = setup(GOOD);
  expect(history.at(-1)).toBe('/pgn');
  expect(sessionStorage.getItem('zugzwang:pgn')).toContain('"white":"ana"');
});

it('still opens the game when the browser blocks storage', () => {
  const block = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  const history = setup(GOOD);
  block.mockRestore();
  expect(history.at(-1)).toBe('/pgn');
});

it('asks which game to open when the text has several, and checks only the chosen one', () => {
  const history = setup(`${BAD}\n\n${GOOD}`);
  expect(history).toEqual(['/']);
  expect(screen.getByRole('group')).toHaveTextContent('2 partidas');
  fireEvent.click(screen.getByRole('radio', { name: /ana – luis/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Analizar esta partida' }));
  expect(history.at(-1)).toBe('/pgn');
});

it('shows the error of the chosen game when it is the bad one', () => {
  const history = setup(`${GOOD}\n\n${BAD}`);
  fireEvent.click(screen.getAllByRole('radio')[1] as HTMLElement);
  fireEvent.click(screen.getByRole('button', { name: 'Analizar esta partida' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Jugada ilegal en 12. Qe5');
  expect(history).toEqual(['/']);
});
