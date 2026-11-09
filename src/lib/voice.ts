import type { Voice } from '../types';

/** Las tres formas de una palabra o frase: femenina, masculina y genérica. */
export interface Forms {
  f: string;
  m: string;
  n: string;
}

/** Elige la forma según cómo quiere que le hable la app. */
export function byVoice(voice: Voice | undefined, forms: Forms): string {
  if (voice === 'femenino') return forms.f;
  if (voice === 'masculino') return forms.m;
  return forms.n;
}

/** Resumen del día según cómo quiere que le hablen: "enfocada", "enfocado" o genérico. */
export function focusPhrase(focused: string, planned: string, voice: Voice = 'neutro'): string {
  return byVoice(voice, {
    f: `${focused} enfocada de ${planned} planificadas`,
    m: `${focused} enfocado de ${planned} planificadas`,
    n: `${focused} de foco de ${planned} planificadas`,
  });
}
