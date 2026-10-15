import type { Difficulty, ISODate, Settings, StarTx, Task } from '../types';
import { addDays } from './time';

/**
 * Un día cuenta para la racha si tenía tareas planificadas y todas quedaron hechas.
 * Los días sin tareas (por ejemplo, fines de semana libres) no suman ni cortan la racha.
 * Hoy solo suma si ya está completo; si no, la racha se cuenta hasta ayer.
 */
export function computeStreak(tasks: Task[], todayDate: ISODate, maxLookback = 120): number {
  const byDay = new Map<ISODate, Task[]>();
  for (const t of tasks) {
    const list = byDay.get(t.date) ?? [];
    list.push(t);
    byDay.set(t.date, list);
  }
  const status = (d: ISODate): 'done' | 'missed' | 'empty' => {
    const list = byDay.get(d);
    if (!list || list.length === 0) return 'empty';
    return list.every((t) => t.done) ? 'done' : 'missed';
  };

  let streak = 0;
  let day = todayDate;
  if (status(day) !== 'done') day = addDays(day, -1);
  for (let i = 0; i < maxLookback; i++, day = addDays(day, -1)) {
    const s = status(day);
    if (s === 'done') streak++;
    else if (s === 'missed') break;
  }
  return streak;
}

export function multiplierFor(streak: number, settings: Pick<Settings, 'streakDays' | 'streakMultiplier'>): number {
  return streak >= settings.streakDays ? settings.streakMultiplier : 1;
}

export function starsForFocus(minutes: number, settings: Settings, multiplier: number): number {
  return Math.floor(Math.floor(minutes) * settings.starsPerMinute * multiplier);
}

export function bonusFor(difficulty: Difficulty, settings: Settings, multiplier: number): number {
  return Math.round(settings.bonus[difficulty] * multiplier);
}

export function balanceOf(stars: StarTx[]): number {
  return stars.reduce((sum, t) => sum + t.amount, 0);
}

/** Es un canje en la tienda (los movimientos antiguos no tienen `kind`). */
export function isRedemption(t: StarTx): boolean {
  return t.kind ? t.kind === 'canje' : t.reason.startsWith('Canjeaste');
}

/**
 * Estrellas ganadas en un rango: todo lo que no es canje, en neto. Así, si desmarcas una
 * tarea (movimiento negativo antiguo), ese bono deja de contar como ganado.
 */
export function earnedBetween(stars: StarTx[], from: number, to: number): number {
  const net = stars
    .filter((s) => s.at >= from && s.at < to && !isRedemption(s))
    .reduce((sum, s) => sum + s.amount, 0);
  return Math.max(0, net);
}

/** Clave con que se guardan las estrellas de una clase. */
export function classRef(date: ISODate, blockId: string): string {
  return `clase:${date}:${blockId}`;
}
