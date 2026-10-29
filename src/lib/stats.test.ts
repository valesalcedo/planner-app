import { describe, expect, it } from 'vitest';
import { initialData } from '../store/defaults';
import { NO_CATEGORY, NO_COURSE, loadKey, weekStats } from './stats';
import { tsAt } from './time';

describe('weekStats', () => {
  it('suma foco y clases por ramo y tipo de actividad', () => {
    const data = initialData();
    data.courses = [{ id: 'calc', name: 'Cálculo', color: '#fff' }];
    data.weekly = [
      { id: 'b', title: 'Cálculo', kind: 'clase', weekday: 0, start: '08:20', end: '09:50', courseId: 'calc', activityId: 'catedra' },
    ];
    data.entries = [
      { id: 'e1', taskId: 't', courseId: 'calc', activityId: 'estudio', start: tsAt('2026-10-13', 600), end: tsAt('2026-10-13', 660) },
      { id: 'e2', taskId: 'u', activityId: 'otro', start: tsAt('2026-10-14', 600), end: tsAt('2026-10-14', 630) },
      { id: 'old', taskId: 't', courseId: 'calc', activityId: 'estudio', start: tsAt('2026-10-05', 600), end: tsAt('2026-10-05', 700) },
    ];
    data.skipped = {};
    const s = weekStats(data, '2026-10-12', tsAt('2026-10-16', 0));
    expect(s.focusTotal).toBe(90);
    expect(s.focusByDay[1]).toBe(60);
    expect(s.classTotal).toBe(90);
    expect(s.load.get('calc')?.get('catedra')).toBe(90);
    expect(s.load.get('calc')?.get('estudio')).toBe(60);
    expect(s.load.get(NO_COURSE)?.get('otro')).toBe(30);
  });

  it('no cuenta clases futuras ni las marcadas como no realizadas', () => {
    const data = initialData();
    data.weekly = [{ id: 'b', title: 'X', kind: 'clase', weekday: 0, start: '08:00', end: '09:00' }];
    data.skipped = { '2026-10-12': ['b'] };
    expect(weekStats(data, '2026-10-12', tsAt('2026-10-20', 0)).classTotal).toBe(0);
    data.skipped = {};
    expect(weekStats(data, '2026-10-12', tsAt('2026-10-12', 0)).classTotal).toBe(0);
  });

  it('las clases que faltaste no suman horas y cuentan en la asistencia', () => {
    const data = initialData();
    data.courses = [{ id: 'calc', name: 'Cálculo', color: '#fff' }];
    data.weekly = [
      { id: 'l', title: 'Cálculo', kind: 'clase', weekday: 0, start: '08:00', end: '09:00', courseId: 'calc' },
      { id: 'm', title: 'Cálculo', kind: 'clase', weekday: 2, start: '08:00', end: '09:00', courseId: 'calc' },
      { id: 'v', title: 'Cálculo', kind: 'clase', weekday: 4, start: '08:00', end: '09:00', courseId: 'calc' },
    ];
    data.attendance = { '2026-10-12': { l: 'fui' }, '2026-10-14': { m: 'falte' } };
    const s = weekStats(data, '2026-10-12', tsAt('2026-10-20', 0));
    expect(s.classTotal).toBe(120);
    expect(s.attendance).toMatchObject({ total: 3, fui: 1, falte: 1 });
    expect(s.attendance.byCourse.get('calc')).toEqual({ total: 3, fui: 1, falte: 1 });
  });

  it('las tareas personales no suman a la carga académica', () => {
    const data = initialData();
    data.entries = [
      { id: 'a', taskId: 't', activityId: 'otro', personal: true, categoryId: 'cat-orga', start: tsAt('2026-10-13', 600), end: tsAt('2026-10-13', 660) },
      { id: 'b', taskId: 'u', activityId: 'otro', personal: true, start: tsAt('2026-10-13', 700), end: tsAt('2026-10-13', 730) },
    ];
    const s = weekStats(data, '2026-10-12', tsAt('2026-10-16', 0));
    expect(s.focusTotal).toBe(90);
    expect(s.load.size).toBe(0);
    expect(s.personal.get('cat-orga')).toBe(60);
    expect(s.personal.get(NO_CATEGORY)).toBe(30);
    expect(s.personalTotal).toBe(90);
  });

  it('detalla qué suma cada fila de la carga académica', () => {
    const data = initialData();
    data.courses = [{ id: 'calc', name: 'Cálculo', color: '#fff' }];
    data.weekly = [
      { id: 'b', title: 'Cálculo cátedra', kind: 'clase', weekday: 0, start: '08:20', end: '09:50', courseId: 'calc', activityId: 'catedra' },
      { id: 'b2', title: 'Cálculo cátedra', kind: 'clase', weekday: 2, start: '08:20', end: '09:50', courseId: 'calc', activityId: 'catedra' },
    ];
    data.tasks = [
      { id: 't', title: 'Control 4', done: true } as never,
    ];
    data.entries = [
      { id: 'e1', taskId: 't', courseId: 'calc', activityId: 'estudio', start: tsAt('2026-10-13', 600), end: tsAt('2026-10-13', 660) },
      { id: 'e2', taskId: 't', courseId: 'calc', activityId: 'estudio', start: tsAt('2026-10-15', 600), end: tsAt('2026-10-15', 630), manual: true },
      { id: 'e3', taskId: 'gone', courseId: 'calc', activityId: 'estudio', start: tsAt('2026-10-14', 600), end: tsAt('2026-10-14', 610) },
    ];
    data.skipped = {};
    data.attendance = { '2026-10-14': { b2: 'falte' } };
    const s = weekStats(data, '2026-10-12', tsAt('2026-10-20', 0));

    const estudio = s.loadItems.get(loadKey('calc', 'estudio'))!;
    expect(estudio.map((i) => [i.label, i.min, i.done, i.manualMin])).toEqual([
      ['Control 4', 90, true, 30],
      ['Tarea borrada', 10, false, 0],
    ]);
    expect(estudio[0].days).toEqual(['2026-10-13', '2026-10-15']);

    const catedra = s.loadItems.get(loadKey('calc', 'catedra'))!;
    expect(catedra).toHaveLength(1);
    expect(catedra[0]).toMatchObject({ kind: 'clase', count: 1, min: 90 });

    for (const [course, row] of s.load) {
      for (const [act, min] of row) {
        const sum = (s.loadItems.get(loadKey(course, act)) ?? []).reduce((a, i) => a + i.min, 0);
        expect(sum).toBe(min);
      }
    }
  });
});
