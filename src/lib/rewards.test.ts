import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { DEFAULT_SETTINGS } from '../store/defaults';
import { computeStreak, earnedBetween, multiplierFor, starsForFocus } from './rewards';

const t = (date: string, done: boolean): Task => ({
  id: `${date}-${done}-${Math.random()}`,
  title: 'x',
  date,
  mustToday: false,
  difficulty: 'facil',
  estimateMin: 10,
  activityId: 'otro',
  subtasks: [],
  done,
  createdAt: 0,
});

describe('computeStreak', () => {
  it('cuenta días completos seguidos y salta los días sin tareas', () => {
    const tasks = [t('2026-10-10', true), t('2026-10-12', true), t('2026-10-13', true), t('2026-10-14', true)];
    // 11 no tiene tareas: no corta la racha.
    expect(computeStreak(tasks, '2026-10-15')).toBe(4);
  });

  it('un día con tareas pendientes corta la racha', () => {
    const tasks = [t('2026-10-12', true), t('2026-10-13', false), t('2026-10-14', true)];
    expect(computeStreak(tasks, '2026-10-15')).toBe(1);
  });

  it('hoy suma solo si está completo', () => {
    expect(computeStreak([t('2026-10-14', true), t('2026-10-15', true)], '2026-10-15')).toBe(2);
    expect(computeStreak([t('2026-10-14', true), t('2026-10-15', false)], '2026-10-15')).toBe(1);
  });
});

describe('estrellas', () => {
  it('da 1 por minuto y aplica el multiplicador de racha', () => {
    expect(starsForFocus(29.9, DEFAULT_SETTINGS, 1)).toBe(29);
    expect(starsForFocus(50, DEFAULT_SETTINGS, multiplierFor(3, DEFAULT_SETTINGS))).toBe(60);
    expect(multiplierFor(2, DEFAULT_SETTINGS)).toBe(1);
  });
});

describe('earnedBetween', () => {
  it('no cuenta canjes y descuenta los movimientos negativos antiguos', () => {
    const stars = [
      { id: '1', amount: 10, reason: 'Terminaste "X"', at: 5 },
      { id: '2', amount: -12, reason: 'Desmarcaste "X"', at: 6 },
      { id: '3', amount: 10, reason: 'Terminaste "X"', at: 7 },
      { id: '4', amount: -90, reason: 'Canjeaste "Algo rico"', at: 8 },
      { id: '5', amount: 30, reason: 'Foco', at: 9, kind: 'foco' as const },
    ];
    expect(earnedBetween(stars, 0, 100)).toBe(38);
  });
});
