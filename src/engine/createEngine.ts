import type { Engine } from '../domain/engine/engine.ts';
import { type Transport, UciEngine } from '../domain/engine/UciEngine.ts';

// The Stockfish build is its own Worker: UCI goes in and out as plain strings (ADR-008: lite, single thread).
const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;

function workerTransport(): Transport {
  const worker = new Worker(ENGINE_URL);
  return {
    send: (command) => worker.postMessage(command),
    onLine: (callback) => {
      worker.onmessage = (event) => {
        if (typeof event.data === 'string') callback(event.data);
      };
    },
    onError: (callback) => {
      worker.onerror = (event) => callback(event.message || `Could not load ${ENGINE_URL}`);
      worker.onmessageerror = () => callback('Unreadable message from the engine');
    },
    terminate: () => worker.terminate(),
  };
}

export const createEngine = (): Engine => new UciEngine(workerTransport());
