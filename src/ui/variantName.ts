import type { TFunction } from 'i18next';

/** The variant as the person reads it; unknown ones show the name chess.com gave. */
export const variantName = (t: TFunction, variant: string) =>
  t(`variant.${variant.toLowerCase()}`, { defaultValue: variant });
