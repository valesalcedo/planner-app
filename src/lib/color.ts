/** Utilidades para colores elegidos por la usuaria (pueden ser claros u oscuros). */

const FALLBACK = '#DCD6F7';

export function normalizeHex(color: string | undefined): string {
  if (!color) return FALLBACK;
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${[...c.slice(1)].map((x) => x + x).join('')}`.toUpperCase();
  return FALLBACK;
}

function channels(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminancia relativa (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color de texto legible sobre un fondo: tinta oscura de la app o blanco si el fondo es oscuro. */
const INK = '#3B2A35';

export function inkOn(bg: string): string {
  const L = luminance(bg);
  const contrastDark = (L + 0.05) / (luminance(INK) + 0.05);
  const contrastWhite = 1.05 / (L + 0.05);
  return contrastDark >= contrastWhite ? INK : '#FFFFFF';
}

/** Razón de contraste WCAG entre dos colores (1 a 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Mezcla `a` con `b`. `amount` = 0 deja `a`, 1 da `b`. */
export function mix(a: string, b: string, amount: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return toHex(ca.map((v, i) => v + (cb[i] - v) * amount));
}

/** Versión semitransparente de un color, para sombras y velos. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Acerca `color` hacia `toward` de a poco hasta que contraste al menos `min`
 * con todos los fondos de `against`. Sirve para sacar un tono legible del mismo color.
 */
export function readableShade(color: string, toward: string, against: string[], min = 4.5): string {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(color, toward, t);
    if (against.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return normalizeHex(toward);
}

/** El mismo tono, pero vivo: saturado y de luminosidad media (para íconos como la estrella). */
export function vivid(hex: string, lightness = 0.5): string {
  const [r, g, b] = channels(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + 360) % 360;
  const s = d === 0 ? 0 : 0.92;
  const c = (1 - Math.abs(2 * lightness - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r1 + m, g1 + m, b1 + m].map((v) => v * 255));
}

/** Tono para el arco de un anillo sobre el color pastel del ramo: más vivo, sin llegar a chillón. */
export function ringTone(hex: string): string {
  return mix(hex, vivid(hex, 0.52), 0.65);
}
