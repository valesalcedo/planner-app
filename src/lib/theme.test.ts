import { describe, expect, it } from 'vitest';
import { contrast } from './color';
import { customBase, THEME_PRESETS, themeTokens, type ThemeBase } from './theme';

const customs: [string, ThemeBase][] = [
  ['propio claro rojo', customBase('#E53935', '#FFEB3B')],
  ['propio claro gris', customBase('#D9D9D9', '#A6CFF0')],
  ['propio oscuro verde', customBase('#A8DDC0', '#FFBFA0', true)],
  ['propio oscuro azul marino', customBase('#1A237E', '#FFD54F', true)],
];

const all: [string, ThemeBase][] = [...THEME_PRESETS.map((p) => [p.name, p.base] as [string, ThemeBase]), ...customs];

describe('temas legibles', () => {
  it.each(all)('%s: el texto se lee sobre sus fondos', (name, base) => {
    // Un color propio muy saturado puede no permitir 4,5 con ningún texto; ahí se exige el mínimo para texto en negrita.
    const onMin = customs.some(([n]) => n === name) ? 3 : 4.5;
    const t = themeTokens(base);
    const pairs: [string, string, number][] = [
      ['--ink', '--bg', 7],
      ['--ink', '--surface', 7],
      ['--ink-2', '--surface', 4.5],
      ['--ink-3', '--bg', 4.5],
      ['--primary-deep', '--surface', 4.5],
      ['--primary-deep', '--primary-tint', 4.5],
      ['--accent-ink', '--accent', 4.5],
      ['--accent-ink', '--accent-soft', 4.5],
      ['--on-primary', '--primary', onMin],
      ['--on-accent', '--accent', onMin],
      ['--on-ink', '--ink', 7],
      ['--lavender-ink', '--lavender', 4.5],
    ];
    for (const [fg, bg, min] of pairs) {
      expect(contrast(t[fg], t[bg]), `${fg} sobre ${bg}`).toBeGreaterThanOrEqual(min);
    }
  });

  it('el tema original calcula lo mismo que tokens.css en lo principal', () => {
    const t = themeTokens(THEME_PRESETS[0].base);
    expect(t['--primary']).toBe('#F48FB1');
    expect(t['--accent']).toBe('#FDE68A');
  });
});
