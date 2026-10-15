import { describe, expect, it } from 'vitest';
import type { Task, WeeklyBlock } from '../types';
import { buildUnits, busyBlocksFor, freeSlots, planDay } from './scheduler';

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
    expect(first('flex').start).toBeGreaterThan(first('hoy').end);
    expect(plan.overflow).toHaveLength(0);
  });

  it('nunca agenda tareas difíciles en huecos cortos', () => {
    const tasks = [task({ id: 'd', title: 'Difícil', estimateMin: 20, difficulty: 'dificil', mustToday: true })];
    const plan = planDay(buildUnits(tasks, [], DAY), busyBlocksFor(DAY, classes, [], {}), settings);
    expect(plan.placements[0].start).toBe(690);
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
