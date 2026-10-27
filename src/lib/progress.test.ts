import { describe, expect, it } from 'vitest';
import { initialData } from '../store/defaults';
import type { Task } from '../types';
import { courseDetail, weekProgress } from './progress';
import { tsAt } from './time';

const NOW = tsAt('2026-10-28', 12 * 60); // miércoles, semana del 26

function task(p: Partial<Task> & { id: string; date: string }): Task {
  return { title: p.id, mustToday: false, difficulty: 'media', estimateMin: 30, activityId: 'tareas', subtasks: [], done: false, createdAt: 0, ...p };
}

describe('weekProgress', () => {
  it('cuenta las tareas de la semana, las atrasadas pendientes y compara con la anterior', () => {
    const data = initialData();
    data.courses = [
      { id: 'calc', name: 'Cálculo', color: '#DCD6F7' },
      { id: 'alg', name: 'Algoritmos', color: '#F9C6D5' },
    ];
    data.tasks = [
      task({ id: 'hecha', date: '2026-10-26', courseId: 'calc', done: true, doneAt: tsAt('2026-10-26', 700) }),
      task({ id: 'pendiente', date: '2026-10-29', courseId: 'calc' }),
      task({ id: 'atrasada', date: '2026-10-20' }),
      task({ id: 'pasada', date: '2026-10-21', done: true, doneAt: tsAt('2026-10-21', 700) }),
    ];
    data.entries = [{ id: 'e', taskId: 'hecha', courseId: 'calc', activityId: 'estudio', start: tsAt('2026-10-26', 600), end: tsAt('2026-10-26', 690) }];
    const p = weekProgress(data, '2026-10-26', NOW);
    expect(p.total).toBe(3);
    expect(p.done).toBe(1);
    expect(p.prevDone).toBe(1);
    expect(p.focusMin).toBe(90);
    expect(p.courses).toEqual([{ courseId: 'calc', done: 1, total: 2, focusMin: 90 }]);
  });

  it('las tareas atrasadas no se cuentan en semanas pasadas', () => {
    const data = initialData();
    data.tasks = [task({ id: 'vieja', date: '2026-10-01' })];
    expect(weekProgress(data, '2026-10-19', NOW).total).toBe(0);
    expect(weekProgress(data, '2026-10-26', NOW).total).toBe(1);
  });
});

describe('courseDetail', () => {
  it('ordena la asistencia y cuenta la racha actual', () => {
    const data = initialData();
    data.weekly = [{ id: 'b', title: 'Alg', kind: 'clase', weekday: 0, start: '10:00', end: '11:20', courseId: 'alg' }];
    data.attendance = { '2026-10-26': { b: 'fui' }, '2026-10-12': { b: 'falte' }, '2026-10-19': { b: 'fui' } };
    data.events = [
      { id: 'i2', title: 'I2', date: '2026-11-02', kind: 'evaluacion', courseId: 'alg' },
      { id: 'i1', title: 'I1', date: '2026-10-01', kind: 'evaluacion', courseId: 'alg' },
    ];
    const d = courseDetail(data, 'alg', NOW);
    expect(d.recentClasses).toEqual(['falte', 'fui', 'fui']);
    expect(d.currentRun).toBe(2);
    expect(d.nextEval?.id).toBe('i2');
  });
});
