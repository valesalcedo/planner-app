import type { Voice } from '../types';

/** Resumen del día según cómo quiere que le hablen: "enfocada", "enfocado" o genérico. */
export function focusPhrase(focused: string, planned: string, voice: Voice = 'neutro'): string {
  if (voice === 'femenino') return `${focused} enfocada de ${planned} planificadas`;
  if (voice === 'masculino') return `${focused} enfocado de ${planned} planificadas`;
  return `${focused} de foco de ${planned} planificadas`;
}
