import { describe, expect, it } from 'vitest';
import { initialData } from '../store/defaults';
import { NO_COURSE, weekStats } from './stats';
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
});
