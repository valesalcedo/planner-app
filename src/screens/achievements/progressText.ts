import { TIER_NAMES, type AchievementStatus } from '../../lib/achievements';

const n = (x: number) => x.toLocaleString('es-CL');

/** Avance hacia el siguiente nivel, por ejemplo "7 de 10 clases". Vacío si no aplica. */
export function progressText(a: AchievementStatus): string {
  if (!a.next || a.next.goal <= 1) return '';
  const unit = a.unit ? ` ${a.unit}` : '';
  return `${n(Math.min(a.value, a.next.goal))} de ${n(a.next.goal)}${unit}`;
}

/** Nombre del nivel ganado ("Bronce", "Plata"…) si el logro tiene varios. */
export function tierName(a: AchievementStatus): string {
  return a.tiers.length > 1 && a.level > 0 ? TIER_NAMES[a.level - 1] ?? '' : '';
}

/** Avance entre 0 y 1 hacia el siguiente nivel. */
export function progressShare(a: AchievementStatus): number {
  if (!a.next) return 1;
  return Math.min(1, a.value / a.next.goal);
}
