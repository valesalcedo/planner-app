import { beforeEach, describe, expect, it } from 'vitest';
import { balanceOf, classRef, earnedBetween } from '../lib/rewards';
import { today } from '../lib/time';
import { useStore } from './useStore';

const st = () => useStore.getState();

function addTestTask(title = 'Tarea de prueba') {
  st().addTask({
    title,
    date: today(),
    mustToday: false,
    difficulty: 'media',
    estimateMin: 30,
    activityId: 'estudio',
    subtasks: [],
  });
  return st().tasks.at(-1)!.id;
}

describe('estrellas de tareas', () => {
  beforeEach(() => st().resetData());

  it('marcar, desmarcar, volver a marcar y borrar deja todo en cero', () => {
    const id = addTestTask();
    st().setTaskDone(id, true);
    st().setTaskDone(id, false);
    st().setTaskDone(id, true);
    expect(balanceOf(st().stars)).toBe(10);
    expect(st().stars).toHaveLength(1);
    st().deleteTask(id);
    expect(balanceOf(st().stars)).toBe(0);
    expect(earnedBetween(st().stars, 0, Date.now() + 1)).toBe(0);
  });

  it('desmarcar quita exactamente lo que se dio aunque cambie la racha', () => {
    const id = addTestTask();
    st().setTaskDone(id, true); // completa el día: la racha sube
    st().updateSettings({ streakDays: 1, streakMultiplier: 2 });
    st().setTaskDone(id, false);
    expect(balanceOf(st().stars)).toBe(0);
  });

  it('borrar una tarea no toca las estrellas de otras', () => {
    const a = addTestTask('A');
    const b = addTestTask('B');
    st().setTaskDone(a, true);
    st().setTaskDone(b, true);
    st().deleteTask(a);
    expect(st().stars.map((s) => s.ref)).toEqual([b]);
  });
});

describe('asistencia a clases', () => {
  beforeEach(() => st().resetData());

  it('fui suma estrellas, cambiar a falté o "no hubo" las quita', () => {
    st().saveBlock({ title: 'Cálculo', kind: 'clase', weekday: 0, start: '08:20', end: '09:30' });
    const block = st().weekly[0].id;
    const d = '2026-10-12';
    st().setAttendance(d, block, 'fui');
    expect(balanceOf(st().stars)).toBe(5);
    expect(st().stars[0].ref).toBe(classRef(d, block));
    st().setAttendance(d, block, 'fui');
    expect(balanceOf(st().stars)).toBe(5);
    st().setAttendance(d, block, 'falte');
    expect(balanceOf(st().stars)).toBe(0);
    expect(st().attendance[d][block]).toBe('falte');
    st().setAttendance(d, block, 'fui');
    st().toggleSkip(d, block);
    expect(balanceOf(st().stars)).toBe(0);
    expect(st().attendance[d][block]).toBeUndefined();
  });
});

describe('categorías', () => {
  beforeEach(() => st().resetData());

  it('al borrar una categoría las actividades quedan sin categoría', () => {
    const cat = st().saveCategory({ name: 'Coro', color: '#BFB3F0' });
    st().saveBlock({ title: 'Ensayo', kind: 'actividad', weekday: 2, start: '19:00', end: '21:00', categoryId: cat });
    st().deleteCategory(cat);
    expect(st().weekly[0].categoryId).toBeUndefined();
    expect(st().categories.find((c) => c.id === cat)).toBeUndefined();
  });
});

describe('tiempo a mano', () => {
  beforeEach(() => st().resetData());

  it('agrega un registro con estrellas y borrarlo las quita', () => {
    const id = addTestTask();
    const earned = st().addManualEntry({ taskId: id, date: '2026-10-12', start: '10:00', end: '11:30' });
    expect(earned).toBe(90);
    const entry = st().entries[0];
    expect(entry.manual).toBe(true);
    expect((entry.end - entry.start) / 60000).toBe(90);
    expect(balanceOf(st().stars)).toBe(90);
    st().deleteEntry(entry.id);
    expect(st().entries).toHaveLength(0);
    expect(balanceOf(st().stars)).toBe(0);
  });

  it('rechaza horas al revés o en el futuro', () => {
    const id = addTestTask();
    expect(st().addManualEntry({ taskId: id, date: '2026-10-12', start: '11:00', end: '10:00' })).toBeNull();
    expect(st().addManualEntry({ taskId: id, date: '2999-01-01', start: '10:00', end: '11:00' })).toBeNull();
    expect(st().entries).toHaveLength(0);
  });

  it('las tareas personales guardan su categoría y no su ramo', () => {
    st().addTask({
      title: 'Ordenar escritorio',
      date: today(),
      mustToday: false,
      difficulty: 'facil',
      estimateMin: 30,
      activityId: 'otro',
      personal: true,
      categoryId: 'cat-orga',
      subtasks: [],
    });
    const id = st().tasks.at(-1)!.id;
    st().addManualEntry({ taskId: id, date: '2026-10-12', start: '10:00', end: '10:30' });
    expect(st().entries[0]).toMatchObject({ personal: true, categoryId: 'cat-orga', courseId: undefined });
  });
});

describe('traslados y tareas fijadas', () => {
  beforeEach(() => st().resetData());

  it('fija y suelta una tarea en un día', () => {
    const d = today();
    st().setPin(d, 'abc', { at: '15:00' });
    expect(st().pins[d]).toEqual({ abc: { at: '15:00' } });
    st().setPin(d, 'abc', null);
    expect(st().pins[d]).toEqual({});
  });

  it('dar inicio a un traslado lo mueve a ahora, y al llegar guarda lo que duró', () => {
    const d = today();
    st().setTravel(d, 'vuelta', { removed: true });
    st().startTravel(d, 'vuelta');
    const o = st().travel[d]!.vuelta!;
    expect(o.removed).toBeUndefined();
    expect(o.startedAt).toBeGreaterThan(0);
    expect(o.start).toMatch(/^\d\d:\d\d$/);
    st().arriveTravel(d, 'vuelta');
    expect(st().travel[d]!.vuelta!.durationMin).toBe(1);
    st().undoArriveTravel(d, 'vuelta');
    expect(st().travel[d]!.vuelta!.durationMin).toBeUndefined();
    expect(st().travel[d]!.vuelta!.startedAt).toBeGreaterThan(0);
    st().undoStartTravel(d, 'vuelta');
    expect(st().travel[d]!.vuelta!.startedAt).toBeUndefined();
    expect(st().travel[d]!.vuelta!.start).toBeUndefined();
    st().setTravel(d, 'vuelta', null);
    expect(st().travel[d]).toEqual({});
  });

  it('los datos guardados antes de esta versión se completan con los valores nuevos', () => {
    const old = { ...st(), travel: undefined, pins: undefined, settings: { ...st().settings, travelMin: undefined } } as never;
    st().importData(old);
    expect(st().travel).toEqual({});
    expect(st().pins).toEqual({});
    expect(st().settings.travelMin).toBe(60);
  });
});
