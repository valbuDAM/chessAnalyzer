import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import { useEffect, useRef } from 'react';
import 'chessground/assets/chessground.base.css';
import './Board.css';

export function Board({
  fen,
  label,
  orientation = 'white',
}: {
  fen: string;
  label: string;
  orientation?: 'white' | 'black';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<Api>(null);
  useEffect(() => {
    if (!ref.current) return;
    api.current = Chessground(ref.current, { viewOnly: true, coordinates: true });
    return () => api.current?.destroy();
  }, []);
  // set() on the live instance, so pieces animate to their new square instead of the board being rebuilt
  useEffect(() => api.current?.set({ fen, orientation }), [fen, orientation]);
  return <div className="board" ref={ref} role="img" aria-label={label} />;
}
