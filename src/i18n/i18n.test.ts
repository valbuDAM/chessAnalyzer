import i18n from 'i18next';
import { expect, it } from 'vitest';
import './index.ts';

it('resolves a known key', () => {
  expect(i18n.t('app.title')).toBe('Zugzwang');
});

it('rejects unknown keys at typecheck time', () => {
  // @ts-expect-error la clave no existe en es.json
  i18n.t('clave.inexistente');
});
