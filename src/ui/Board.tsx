import { Chessground } from 'chessground';
import { useEffect, useRef } from 'react';
import 'chessground/assets/chessground.base.css';
import './Board.css';

export function Board({ fen, label }: { fen: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const api = Chessground(ref.current, { fen, viewOnly: true, coordinates: true });
    return () => api.destroy();
  }, [fen]);
  return <div className="board" ref={ref} role="img" aria-label={label} />;
}
