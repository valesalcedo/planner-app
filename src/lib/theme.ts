import { contrast, mix, normalizeHex, readableShade, vivid, withAlpha } from './color';
import type { ThemeSetting } from '../types';

/** Lo mínimo para armar un tema: el resto de los colores se calcula a partir de esto. */
export interface ThemeBase {
  bg: string;
  surface: string;
  ink: string;
  primary: string;
  accent: string;
  dark?: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  base: ThemeBase;
}

export const DEFAULT_THEME: ThemeSetting = { id: 'original' };

/** Temas listos para elegir. El primero es el original de la app. */
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'original', name: 'Rosado y amarillo', base: { bg: '#FFF8F3', surface: '#FFFFFF', ink: '#3B2A35', primary: '#F48FB1', accent: '#FDE68A' } },
  { id: 'oceano', name: 'Océano', base: { bg: '#F1F8FB', surface: '#FFFFFF', ink: '#1E3440', primary: '#7EC8E8', accent: '#FFD9A0' } },
  { id: 'bosque', name: 'Bosque', base: { bg: '#F3F8F1', surface: '#FFFFFF', ink: '#25392B', primary: '#92D4A9', accent: '#F6E08B' } },
  { id: 'lavanda', name: 'Lavanda', base: { bg: '#F8F5FD', surface: '#FFFFFF', ink: '#33294A', primary: '#BBA9F2', accent: '#FFC9DE' } },
  { id: 'durazno', name: 'Durazno', base: { bg: '#FFF6EF', surface: '#FFFFFF', ink: '#46291D', primary: '#FFB089', accent: '#FFE48C' } },
  { id: 'cereza', name: 'Cereza', base: { bg: '#FFF5F5', surface: '#FFFFFF', ink: '#3D1F24', primary: '#F2777F', accent: '#FFD3B4' } },
  { id: 'grafito', name: 'Grafito', base: { bg: '#F5F5F3', surface: '#FFFFFF', ink: '#26262A', primary: '#B9BEC8', accent: '#E9E2C9' } },
  { id: 'noche', name: 'Noche', base: { bg: '#17141C', surface: '#231E2A', ink: '#F2EAF3', primary: '#EC8DB2', accent: '#F3D46E', dark: true } },
  { id: 'medianoche', name: 'Medianoche', base: { bg: '#10171F', surface: '#1A2430', ink: '#E7F0F7', primary: '#7FC4E6', accent: '#A9E3BE', dark: true } },
];

const DARK_TEXT = '#1C1820';

/** Arma un tema completo (claro u oscuro) a partir de los dos colores que eligió la persona. */
export function customBase(primary: string, accent: string, dark = false): ThemeBase {
  const p = normalizeHex(primary);
  return dark
    ? { bg: mix(p, '#000000', 0.9), surface: mix(p, '#000000', 0.84), ink: mix(p, '#FFFFFF', 0.9), primary: p, accent: normalizeHex(accent), dark }
    : { bg: mix(p, '#FFFFFF', 0.93), surface: '#FFFFFF', ink: readableShade(mix(p, '#000000', 0.7), '#000000', [mix(p, '#FFFFFF', 0.93)], 10), primary: p, accent: normalizeHex(accent) };
}

/** Texto legible sobre un color: el del tema, uno oscuro o blanco, el que contraste más. */
function textOn(bg: string, ink: string): string {
  return [ink, DARK_TEXT, '#FFFFFF'].reduce((best, c) => (contrast(c, bg) > contrast(best, bg) ? c : best));
}

/** Todas las variables CSS del tema (las mismas que define src/styles/tokens.css). */
export function themeTokens(b: ThemeBase): Record<string, string> {
  const { bg, surface, ink, primary, accent } = b;
  const dark = !!b.dark;
  const deep = readableShade(primary, ink, [surface, bg, mix(primary, surface, 0.8)]);
  const accentSoft = mix(accent, '#FFFFFF', 0.55);
  const lavender = dark ? '#3A3352' : '#DCD6F7';
  const mint = dark ? '#24402F' : '#C9EBD8';

  return {
    '--bg': bg,
    '--surface': surface,
    '--line': mix(primary, surface, 0.8),
    '--ink': ink,
    '--ink-2': readableShade(mix(ink, bg, 0.35), ink, [surface, bg]),
    '--ink-3': readableShade(mix(ink, primary, 0.45), ink, [surface, bg]),
    '--ink-faint': mix(ink, bg, 0.65),

    '--primary': primary,
    '--primary-soft': mix(primary, surface, 0.5),
    '--primary-tint': mix(primary, surface, 0.8),
    '--primary-deep': deep,
    '--primary-strong': mix(primary, deep, 0.5),
    '--primary-edge': mix(primary, surface, 0.3),

    '--accent': accent,
    '--accent-soft': accentSoft,
    '--star': vivid(accent, 0.52),
    '--accent-ink': readableShade(accent, '#000000', [accent, accentSoft]),
    '--accent-edge': readableShade(accent, dark ? '#FFFFFF' : '#000000', [surface], 3),
    '--eval': readableShade(accent, dark ? '#FFFFFF' : '#000000', [surface], 2.2),

    '--lavender': lavender,
    '--lavender-ink': textOn(lavender, dark ? '#D9D1FF' : '#4F4466'),
    '--mint': mint,
    '--mint-ink': dark ? '#9FE0B8' : '#24563D',
    '--danger': dark ? '#FF8A80' : '#B3261E',
    '--danger-edge': dark ? '#6B2B28' : '#F1C3BF',

    '--on-primary': textOn(primary, ink),
    '--on-accent': textOn(accent, ink),
    '--on-ink': surface,
    '--switch-off': mix(ink, surface, 0.78),
    '--knob': dark ? ink : '#FFFFFF',
    '--overlay': withAlpha(dark ? '#000000' : ink, dark ? 0.55 : 0.35),
    '--float-shadow-color': withAlpha(dark ? '#000000' : deep, dark ? 0.5 : 0.22),
  };
}

export function resolveTheme(setting: ThemeSetting | undefined): ThemeBase {
  const s = setting ?? DEFAULT_THEME;
  if (s.id === 'custom') return customBase(s.primary ?? '#F48FB1', s.accent ?? '#FDE68A', s.dark);
  return (THEME_PRESETS.find((p) => p.id === s.id) ?? THEME_PRESETS[0]).base;
}

/** Pinta toda la app con el tema elegido. El tema original usa los valores de tokens.css tal cual. */
export function applyTheme(setting: ThemeSetting | undefined): void {
  const root = document.documentElement;
  const isOriginal = !setting || setting.id === 'original';
  const base = resolveTheme(setting);
  const tokens = themeTokens(base);

  for (const name of Object.keys(tokens)) {
    if (isOriginal) root.style.removeProperty(name);
    else root.style.setProperty(name, tokens[name]);
  }
  root.style.colorScheme = base.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', base.bg);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', base.dark ? 'black' : 'default');
}
