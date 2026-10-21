import { describe, expect, it } from 'vitest';
import { focusPhrase } from './voice';

describe('focusPhrase', () => {
  it('habla según lo elegido', () => {
    expect(focusPhrase('1 h', '2 h', 'femenino')).toBe('1 h enfocada de 2 h planificadas');
    expect(focusPhrase('1 h', '2 h', 'masculino')).toBe('1 h enfocado de 2 h planificadas');
    expect(focusPhrase('1 h', '2 h', 'neutro')).toBe('1 h de foco de 2 h planificadas');
    expect(focusPhrase('1 h', '2 h')).toBe('1 h de foco de 2 h planificadas');
  });
});
