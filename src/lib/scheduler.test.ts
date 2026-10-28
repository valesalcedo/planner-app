import { describe, expect, it } from 'vitest';
import type { Task, WeeklyBlock } from '../types';
import { buildUnits, busyBlocksFor, freeSlots, planDay, travelBlocksFor } from './scheduler';

const DAY = '2026-10-15'; // jueves
const settings = { dayStart: '08:00', dayEnd: '20:00', bufferMin: 5 };

function task(p: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    date: DAY,
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

const classes: WeeklyBlock[] = [
  { id: 'c1', title: 'Cálculo', kind: 'clase', weekday: 3, start: '08:20', end: '09:50' },
  { id: 'c2', title: 'Algoritmos', kind: 'clase', weekday: 3, start: '10:20', end: '11:30' },
  { id: 'c3', title: 'Otro día', kind: 'clase', weekday: 1, start: '12:00', end: '13:00' },
];

describe('freeSlots', () => {
  it('marca como corto el hueco entre dos clases', () => {
    const busy = busyBlocksFor(DAY, classes, [], {});
    const slots = freeSlots(busy, 480, 1200, 0);
    expect(slots.map((s) => [s.start, s.end, s.short])).toEqual([
      [480, 500, true],
      [590, 620, true],
      [690, 1200, false],
    ]);
  });

  it('ignora clases marcadas como no realizadas', () => {
    const busy = busyBlocksFor(DAY, classes, [], { [DAY]: ['c2'] });
    expect(busy.map((b) => b.title)).toEqual(['Cálculo']);
  });
});

describe('planDay', () => {
  it('pone lo fácil y corto entre clases y lo urgente primero en el hueco largo', () => {
    const tasks = [
      task({ id: 'flex', title: 'Leer apunte', estimateMin: 60, difficulty: 'media' }),
      task({ id: 'hoy', title: 'Informe', estimateMin: 90, difficulty: 'dificil', deadline: DAY }),
      task({ id: 'mail', title: 'Correos', estimateMin: 15, difficulty: 'facil' }),
    ];
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings);
    const first = (id: string) => plan.placements.find((p) => p.unit.taskId === id)!;
    expect(first('mail').start).toBe(480); // primer hueco corto
    expect(first('hoy').start).toBe(690); // apenas termina Algoritmos
    // Leer apunte no cabe entera entre clases: un trozo ahí y el resto después del Informe.
    const flex = plan.placements.filter((p) => p.unit.taskId === 'flex');
    expect(flex[0]).toMatchObject({ start: 590, end: 620, partial: true });
    expect(flex[1].start).toBeGreaterThan(first('hoy').end);
    expect(plan.overflow).toHaveLength(0);
  });

  it('en huecos cortos prefiere lo que no es difícil', () => {
    const tasks = [
      task({ id: 'd', title: 'Difícil', estimateMin: 20, difficulty: 'dificil', mustToday: true }),
      task({ id: 'm', title: 'Media', estimateMin: 20, difficulty: 'media' }),
    ];
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings);
    expect(plan.placements.find((p) => p.unit.taskId === 'm')!.start).toBe(480);
    expect(plan.placements.find((p) => p.unit.taskId === 'd')!.start).toBeGreaterThan(480);
  });

  it('si nada cabe entero en un hueco corto, agenda un trozo en vez de dejarlo libre', () => {
    const tasks = [task({ id: 'big', title: 'Control', estimateMin: 120, difficulty: 'media' })];
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings);
    expect(plan.placements[0]).toMatchObject({ start: 480, end: 500, partial: true });
    expect(plan.placements[1]).toMatchObject({ start: 590, end: 620, partial: true });
    expect(plan.overflow).toHaveLength(0);
  });

  it('divide una tarea larga y deja en overflow lo que no cabe', () => {
    const tasks = [task({ id: 'big', title: 'Proyecto', estimateMin: 600, difficulty: 'dificil' })];
    const plan = planDay(buildUnits(tasks, [], DAY), [], { ...settings, dayEnd: '12:00' });
    expect(plan.placements).toHaveLength(1);
    expect(plan.placements[0].partial).toBe(true);
    expect(plan.overflow[0].remainingMin).toBe(600 - 240);
  });

  it('respeta el orden de las subtareas y descuenta el tiempo ya registrado', () => {
    const t = task({
      id: 't',
      title: 'Informe',
      subtasks: [
        { id: 's1', title: 'Marco', estimateMin: 40, done: false },
        { id: 's2', title: 'Resultados', estimateMin: 45, done: false },
      ],
    });
    const entries = [{ id: 'e', taskId: 't', subtaskId: 's1', activityId: 'tareas', start: 0, end: 30 * 60000 }];
    const plan = planDay(buildUnits([t], entries, DAY), [], settings);
    expect(plan.placements.map((p) => [p.unit.subtaskId, p.end - p.start])).toEqual([
      ['s1', 10],
      ['s2', 45],
    ]);
  });

  it('empieza desde la hora actual', () => {
    const tasks = [task({ id: 'a', title: 'A' })];
    const plan = planDay(buildUnits(tasks, [], DAY), [], settings, 15 * 60);
    expect(plan.placements[0].start).toBe(900);
  });
});

describe('traslados', () => {
  const travelSettings = { travelEnabled: true, travelMin: 60 };

  it('la ida termina al empezar la primera clase y la vuelta parte al terminar la última', () => {
    const t = travelBlocksFor(DAY, classes, {}, undefined, travelSettings);
    expect(t.map((x) => [x.leg, x.start, x.end])).toEqual([
      ['ida', 440, 500],
      ['vuelta', 690, 750],
    ]);
  });

  it('no hay traslados si no hay clases ese día o si están todas suspendidas', () => {
    expect(travelBlocksFor('2026-10-17', classes, {}, undefined, travelSettings)).toEqual([]);
    expect(travelBlocksFor(DAY, classes, { [DAY]: ['c1', 'c2'] }, undefined, travelSettings)).toEqual([]);
  });

  it('respeta la hora a la que lo moviste', () => {
    const t = travelBlocksFor(DAY, classes, {}, { vuelta: { start: '18:00' } }, travelSettings);
    const vuelta = t.find((x) => x.leg === 'vuelta')!;
    expect([vuelta.start, vuelta.end, vuelta.moved]).toEqual([1080, 1140, true]);
  });

  it('cuenta como ocupado y solo recibe tareas marcadas para el transporte', () => {
    const tasks = [
      task({ id: 'leer', title: 'Lectura', estimateMin: 40, onTheGo: true }),
      task({ id: 'pc', title: 'Programar', estimateMin: 60, difficulty: 'dificil' }),
    ];
    const travel = travelBlocksFor(DAY, classes, {}, undefined, travelSettings);
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings, 0, { travel });
    const leer = plan.placements.find((p) => p.unit.taskId === 'leer')!;
    const pc = plan.placements.find((p) => p.unit.taskId === 'pc')!;
    expect(leer.travel).toBe('ida');
    expect(leer.start).toBe(440);
    expect(pc.travel).toBeUndefined();
    // Programar no se agenda durante la vuelta (11:30–12:30).
    const pcs = plan.placements.filter((p) => p.unit.taskId === 'pc');
    expect(pcs.every((p) => p.end <= 690 || p.start >= 750)).toBe(true);
  });

  it('un traslado quitado no ocupa tiempo', () => {
    const travel = travelBlocksFor(DAY, classes, {}, { vuelta: { removed: true } }, travelSettings);
    const tasks = [task({ id: 'pc', title: 'Programar', estimateMin: 60 })];
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings, 0, { travel });
    // Justo después de la última clase (donde estaba la vuelta) hay tarea.
    expect(plan.placements.some((p) => p.start === 690)).toBe(true);
  });
});

describe('tareas fijadas', () => {
  it('quedan a la hora donde las dejaste y el resto se ordena alrededor', () => {
    const tasks = [
      task({ id: 'a', title: 'Urgente', estimateMin: 60, deadline: DAY }),
      task({ id: 'b', title: 'Fijada', estimateMin: 60 }),
    ];
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings, 0, {
      pins: { b: { at: '12:00' } },
    });
    const b = plan.placements.find((p) => p.unit.taskId === 'b')!;
    const as = plan.placements.filter((p) => p.unit.taskId === 'a');
    expect([b.start, b.end, b.pinned]).toEqual([720, 780, true]);
    // La otra se reparte alrededor, sin pisar la fijada.
    expect(as.every((p) => p.end <= 720 || p.start >= 780)).toBe(true);
    expect(plan.overflow).toHaveLength(0);
  });

  it('una tarea arrastrada a un traslado va ahí aunque no esté marcada', () => {
    const tasks = [task({ id: 'x', title: 'Resumen', estimateMin: 30 })];
    const travel = travelBlocksFor(DAY, classes, {}, undefined, { travelEnabled: true, travelMin: 60 });
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings, 0, {
      travel,
      pins: { x: { travel: 'vuelta' } },
    });
    expect(plan.placements.map((p) => [p.start, p.travel, p.pinned])).toEqual([[690, 'vuelta', true]]);
  });

  it('una fijada encima de una clase se corre a cuando termina', () => {
    const tasks = [task({ id: 'x', title: 'Resumen', estimateMin: 30 })];
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings, 0, {
      pins: { x: { at: '09:00' } },
    });
    expect(plan.placements[0].start).toBe(590);
  });

  it('muestra los huecos libres que quedan', () => {
    const plan = planDay([], busyBlocksFor(DAY, classes, [], {}), settings);
    expect(plan.gaps).toEqual([
      { start: 480, end: 500 },
      { start: 590, end: 620 },
      { start: 690, end: 1200 },
    ]);
  });
});

describe('clases marcadas "no voy"', () => {
  it('se siguen mostrando, pero su tiempo queda libre para tareas', () => {
    const attendance = { [DAY]: { c1: 'falte' as const } };
    const busy = busyBlocksFor(DAY, classes, [], {}, attendance);
    expect(busy.find((b) => b.sourceId === 'c1')?.free).toBe(true);
    const units = buildUnits([task({ id: 't', title: 'Guía', estimateMin: 60 })], [], DAY);
    const plan = planDay(units, busy, settings, 0);
    expect(plan.busy.map((b) => b.sourceId)).toContain('c1');
    expect(plan.placements[0].start).toBeLessThan(9 * 60);
  });

  it('no cambian el traslado: queda igual hasta que lo quites', () => {
    const s = { travelEnabled: true, travelMin: 60 };
    const normal = travelBlocksFor(DAY, classes, {}, undefined, s);
    const oneOff = travelBlocksFor(DAY, classes, {}, undefined, s, { [DAY]: { c1: 'falte' } });
    const allOff = travelBlocksFor(DAY, classes, {}, undefined, s, { [DAY]: { c1: 'falte', c2: 'falte' } });
    expect(oneOff).toEqual(normal);
    expect(allOff).toEqual(normal);
    const home = travelBlocksFor(DAY, classes, {}, { ida: { removed: true }, vuelta: { removed: true } }, s, {
      [DAY]: { c1: 'falte', c2: 'falte' },
    });
    expect(home.every((t) => t.removed)).toBe(true);
  });
});
