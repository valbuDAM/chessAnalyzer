// Development tool (unlinked, noindex): runs the real engine in the browser so e2e can check it. Not localized on purpose.
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Engine } from '../domain/engine/engine.ts';
import '../styles/base.css';
import { createEngine } from './createEngine.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function EngineCheck() {
  const engine = useRef<Engine>(null);
  const [fen, setFen] = useState(START);
  const [depth, setDepth] = useState(10);
  const [result, setResult] = useState('');
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    engine.current = createEngine();
    return () => engine.current?.dispose();
  }, []);

  // Keeps counting while the engine thinks: proves the UI thread is not blocked.
  useEffect(() => {
    const id = setInterval(() => setTicks((n) => n + 1), 50);
    return () => clearInterval(id);
  }, []);

  const analyse = async (event: React.FormEvent) => {
    event.preventDefault();
    setResult('Analizando…');
    try {
      setResult(JSON.stringify(await engine.current?.analyse(fen, { depth })));
    } catch (error) {
      setResult(`${error instanceof Error ? error.name : 'Error'}: ${error instanceof Error ? error.message : error}`);
    }
  };

  return (
    <main>
      <h1>Prueba del motor</h1>
      <form onSubmit={analyse}>
        <label>
          FEN <input value={fen} onChange={(e) => setFen(e.target.value)} size={60} />
        </label>
        <label>
          Profundidad{' '}
          <input type="number" min={1} max={30} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
        </label>
        <button type="submit" style={{ background: 'var(--color-raised)' }}>
          Analizar
        </button>
      </form>
      <output aria-label="Resultado">{result}</output>
      <p>
        Pulsos: <span data-testid="ticks">{ticks}</span>
      </p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <EngineCheck />
  </StrictMode>,
);
