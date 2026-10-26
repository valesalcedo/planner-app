import { describe, expect, it } from 'vitest';
import type { Subtask, Task, WeeklyBlock } from '../types';
import { buildUnits } from './scheduler';
import { type SpreadContext, spreadSubtasks, taskDays } from './spread';

const MON = '2026-10-26';
const TUE = '2026-10-27';
const WED = '2026-10-28';
const THU = '2026-10-29';
const FRI = '2026-10-30';

const sub = (id: string, min = 60, p: Partial<Subtask> = {}): Subtask => ({ id, title: id, estimateMin: min, done: false, ...p });

function task(p: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: p.id,
    date: MON,
    mustToday: false,
    difficulty: 'media',
    estimateMin: 0,
    activityId: 'tareas',
    subtasks: [],
    done: false,
    createdAt: 0,
    ...p,
  };
}

function ctx(p: Partial<SpreadContext> = {}): SpreadContext {
  return {
    today: MON,
    nowMin: 0,
    entries: [],
    weekly: [],
    events: [],
    skipped: {},
    travel: {},
    settings: { dayStart: '08:00', dayEnd: '20:00', bufferMin: 0, travelEnabled: false, travelMin: 60 },
    ...p,
  };
}

describe('spreadSubtasks', () => {
  it('reparte parejo las subtareas entre el inicio y la entrega', () => {
    const t = task({ id: 'inf', deadline: WED, subtasks: [sub('a'), sub('b'), sub('c')] });
    const days = spreadSubtasks([t], ctx());
    expect([days.get('a'), days.get('b'), days.get('c')]).toEqual([MON, TUE, WED]);
  });

  it('con más días que subtareas, las espacia en vez de amontonarlas al principio', () => {
    const t = task({ id: 'x', deadline: FRI, subtasks: [sub('a'), sub('b')] });
    const days = spreadSubtasks([t], ctx());
    expect(days.get('a')).not.toBe(days.get('b'));
    expect(days.get('b')! > days.get('a')!).toBe(true);
  });

  it('si una subtarea no cabe en el tiempo libre del día, pasa al siguiente', () => {
    // Lunes casi lleno de clases: solo queda 1 hora libre.
    const weekly: WeeklyBlock[] = [{ id: 'c', title: 'Clases', kind: 'clase', weekday: 0, start: '09:00', end: '20:00' }];
    const t = task({ id: 'x', deadline: TUE, subtasks: [sub('a', 120), sub('b', 30)] });
    const days = spreadSubtasks([t], ctx({ weekly }));
    expect(days.get('a')).toBe(TUE);
    expect(days.get('b')).toBe(TUE); // el último día recibe lo que quede
  });

  it('descuenta lo que otras tareas ya ocupan ese día', () => {
    const other = task({ id: 'o', date: MON, estimateMin: 11 * 60 + 30 });
    const t = task({ id: 'x', deadline: TUE, subtasks: [sub('a', 60), sub('b', 60)] });
    const days = spreadSubtasks([other, t], ctx());
    expect(days.get('a')).toBe(TUE);
  });

  it('respeta el día elegido a mano y reparte el resto', () => {
    const t = task({ id: 'x', deadline: WED, subtasks: [sub('a'), sub('b', 60, { date: WED }), sub('c')] });
    const days = spreadSubtasks([t], ctx());
    expect(days.has('b')).toBe(false);
    expect(taskDays(t, days, MON)).toContain(WED);
  });

  it('lo que quedó atrás se vuelve a repartir desde hoy', () => {
    const t = task({ id: 'x', date: '2026-10-20', deadline: TUE, subtasks: [sub('a'), sub('b')] });
    const days = spreadSubtasks([t], ctx());
    expect([days.get('a'), days.get('b')]).toEqual([MON, TUE]);
  });

  it('no reparte las tareas "sí o sí ese día" ni las sin fecha de entrega', () => {
    const must = task({ id: 'm', mustToday: true, deadline: WED, subtasks: [sub('a'), sub('b')] });
    const flex = task({ id: 'f', subtasks: [sub('c'), sub('d')] });
    const days = spreadSubtasks([must, flex], ctx());
    expect(days.size).toBe(0);
  });
});

describe('buildUnits con reparto', () => {
  it('cada día solo agenda las subtareas que le tocan', () => {
    const t = task({ id: 'inf', deadline: WED, subtasks: [sub('a'), sub('b'), sub('c')] });
    const days = spreadSubtasks([t], ctx());
    const on = (d: string) => buildUnits([t], [], d, { days, today: MON }).map((u) => u.subtaskId);
    expect(on(MON)).toEqual(['a']);
    expect(on(TUE)).toEqual(['b']);
    expect(on(WED)).toEqual(['c']);
    expect(on(THU)).toEqual([]);
  });

  it('una subtarea con día elegido que ya pasó aparece hoy como atrasada', () => {
    const t = task({ id: 'x', date: '2026-10-20', subtasks: [sub('a', 30, { date: '2026-10-22' })] });
    expect(buildUnits([t], [], MON, { today: MON }).map((u) => u.subtaskId)).toEqual(['a']);
  });
});
