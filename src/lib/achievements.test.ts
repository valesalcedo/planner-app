import { describe, expect, it } from 'vitest';
import { initialData } from '../store/defaults';
import type { Task } from '../types';
import { ACHIEVEMENTS, measure, pendingUnlocks, statusOf } from './achievements';
import { tsAt } from './time';

const NOW = tsAt('2026-10-28', 12 * 60); // miércoles

function task(p: Partial<Task> & { id: string; date: string }): Task {
  return {
    title: p.id,
    mustToday: false,
    difficulty: 'media',
    estimateMin: 30,
    activityId: 'tareas',
    subtasks: [],
    done: false,
    createdAt: 0,
    ...p,
  };
}

describe('logros', () => {
  it('hay 22 logros con ids únicos y niveles de menor a mayor', () => {
    expect(ACHIEVEMENTS).toHaveLength(22);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(22);
    for (const a of ACHIEVEMENTS) {
      a.tiers.forEach((t, i) => i > 0 && expect(t.goal).toBeGreaterThan(a.tiers[i - 1].goal));
    }
  });

  it('cuenta tareas a tiempo, días limpios y paso a paso', () => {
    const data = initialData();
    data.tasks = [
      task({ id: 'a', date: '2026-10-26', deadline: '2026-10-26', done: true, doneAt: tsAt('2026-10-26', 600) }),
      task({ id: 'b', date: '2026-10-26', done: true, doneAt: tsAt('2026-10-26', 900), subtasks: [] }),
      task({
        id: 'c',
        date: '2026-10-27',
        deadline: '2026-10-27',
        done: true,
        doneAt: tsAt('2026-10-28', 60), // un día tarde
        subtasks: [
          { id: 's1', title: '1', estimateMin: 10, done: true },
          { id: 's2', title: '2', estimateMin: 10, done: true },
        ],
      }),
    ];
    const v = measure(data, NOW);
    expect(v.check).toBe(3);
    expect(v['a-tiempo']).toBe(1);
    expect(v['dia-limpio']).toBe(1);
    expect(v['paso-a-paso']).toBe(0);
  });

  it('la racha de asistencia se corta al faltar', () => {
    const data = initialData();
    data.weekly = [{ id: 'b', title: 'Cálculo', kind: 'clase', weekday: 0, start: '08:20', end: '09:50', courseId: 'calc' }];
    data.attendance = {
      '2026-10-05': { b: 'fui' },
      '2026-10-12': { b: 'falte' },
      '2026-10-19': { b: 'fui' },
      '2026-10-26': { b: 'fui' },
    };
    const v = measure(data, NOW);
    expect(v.presente).toBe(3);
    expect(v['racha-asistencia']).toBe(2);
    expect(v.madrugadora).toBe(3);
    // Semanas en que fue a todas las clases de Cálculo: 5, 19 y 26 de octubre.
    expect(v['semana-perfecta']).toBe(3);
  });

  it('da cada nivel una sola vez y no los quita si el valor baja', () => {
    const data = initialData();
    data.stars = [{ id: 'x', amount: 1200, reason: 'test', at: 0, kind: 'ajuste' }];
    const first = statusOf(data, {}, NOW);
    const unlocks = pendingUnlocks(first, {});
    expect(unlocks.find((u) => u.id === 'ahorradora')).toMatchObject({ level: 1, stars: 100 });

    data.stars.push({ id: 'y', amount: -900, reason: 'Canjeaste', at: 1, kind: 'canje' });
    const after = statusOf(data, { ahorradora: 1 }, NOW);
    expect(after.find((a) => a.id === 'ahorradora')?.level).toBe(1);
    expect(pendingUnlocks(after, { ahorradora: 1 }).some((u) => u.id === 'ahorradora')).toBe(false);
  });

  it('da todos los niveles alcanzados de una vez', () => {
    const data = initialData();
    data.entries = [{ id: 'e', taskId: 't', activityId: 'estudio', start: tsAt('2026-10-01', 0), end: tsAt('2026-10-01', 0) + 51 * 3600000 }];
    const unlocks = pendingUnlocks(statusOf(data, {}, NOW), {}).filter((u) => u.id === 'horas');
    expect(unlocks.map((u) => u.level)).toEqual([1, 2]);
  });

  it('cuenta semanas seguidas copiando la carga académica', () => {
    const data = initialData();
    data.surveyWeeks = ['2026-09-21', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];
    expect(measure(data, NOW).encuestada).toBe(4);
  });
});
