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
