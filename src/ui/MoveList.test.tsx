import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { parseGamePgn } from '../domain/pgn.ts';
import '../i18n/index.ts';
import { formatEval } from '../i18n/format.ts';
import { MoveList } from './MoveList.tsx';

vi.mock('../i18n/format.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../i18n/format.ts')>();
  return { ...original, formatEval: vi.fn(original.formatEval) };
});

const positions = parseGamePgn('1. e4 {[%clk 0:02:59.5]} e5 {[%clk 1:00:01]} 2. Nf3 *');

it('lists the moves in numbered pairs with their clocks and marks the current one', () => {
  render(<MoveList positions={positions} ply={2} onSelect={() => {}} />);

  const rows = within(screen.getByRole('list', { name: 'Jugadas' })).getAllByRole('listitem');
  expect(rows.map((r) => r.textContent)).toEqual(['1.e42:59e51:00:01', '2.Nf3']);
  expect(screen.getByRole('button', { name: /e5/ })).toHaveAttribute('aria-current', 'step');
  expect(screen.getByRole('button', { name: /e4/ })).not.toHaveAttribute('aria-current');
});

it('selects the clicked move by its ply', async () => {
  const onSelect = vi.fn();
  render(<MoveList positions={positions} ply={0} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole('button', { name: /Nf3/ }));

  expect(onSelect).toHaveBeenCalledWith(3);
});

it('shows the evaluation of each move when there is one', () => {
  const scores = [0, 20, -30, 10].map((cp) => ({ kind: 'cp' as const, cp }));
  render(<MoveList positions={positions} ply={0} scores={scores} onSelect={() => {}} />);

  expect(screen.getByRole('button', { name: /e4/ })).toHaveTextContent('+0,2');
  expect(screen.getByRole('button', { name: /Nf3/ })).toHaveTextContent('+0,1');
});

it('only re-renders the move whose evaluation just arrived', () => {
  const onSelect = () => {};
  const cp = (n: number) => ({ kind: 'cp' as const, cp: n });
  const before = [cp(0), cp(20)];
  const { rerender } = render(<MoveList positions={positions} ply={0} scores={before} onSelect={onSelect} />);
  vi.mocked(formatEval).mockClear();

  rerender(<MoveList positions={positions} ply={0} scores={[...before, cp(-30)]} onSelect={onSelect} />);

  expect(formatEval).toHaveBeenCalledTimes(1);
});
