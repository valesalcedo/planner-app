import { describe, expect, it } from 'vitest';
import type { Task, TimeEntry } from '../types';
import { doneBlocksFor } from './doneBlocks';
import { tsAt } from './time';

const DAY = '2026-10-15';

function task(p: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    date: DAY,
    mustToday: false,
    difficulty: 'media',
    estimateMin: 60,
    activityId: 'tareas',
    subtasks: [],
    done: false,
    createdAt: 0,
    ...p,
  };
}

let n = 0;
function entry(taskId: string, from: number, to: number, subtaskId?: string, date = DAY): TimeEntry {
  return { id: `e${n++}`, taskId, subtaskId, activityId: 'tareas', start: tsAt(date, from), end: tsAt(date, to) };
}

describe('doneBlocksFor', () => {
  it('deja las tareas hechas en las horas en que se trabajaron', () => {
    const tasks = [task({ id: 'a', title: 'Informe', done: true }), task({ id: 'b', title: 'Pendiente' })];
    const entries = [entry('a', 600, 660), entry('b', 700, 730)];
    expect(doneBlocksFor(DAY, tasks, entries).map((b) => [b.taskId, b.start, b.end])).toEqual([['a', 600, 660]]);
  });

  it('junta registros seguidos de la misma tarea, pero no si hay otra en medio', () => {
    const tasks = [task({ id: 'a', title: 'A', done: true }), task({ id: 'b', title: 'B', done: true })];
    const entries = [entry('a', 600, 630), entry('a', 633, 660), entry('b', 662, 670), entry('a', 672, 690)];
    expect(doneBlocksFor(DAY, tasks, entries).map((b) => [b.taskId, b.start, b.end])).toEqual([
      ['a', 600, 660],
      ['b', 662, 670],
      ['a', 672, 690],
    ]);
  });

  it('muestra subtareas hechas aunque la tarea siga pendiente', () => {
    const tasks = [
      task({
        id: 'a',
        title: 'Tarea',
        subtasks: [
          { id: 's1', title: 'Parte 1', estimateMin: 30, done: true },
          { id: 's2', title: 'Parte 2', estimateMin: 30, done: false },
        ],
      }),
    ];
    const entries = [entry('a', 600, 630, 's1'), entry('a', 640, 650, 's2')];
    const blocks = doneBlocksFor(DAY, tasks, entries);
    expect(blocks.map((b) => [b.title, b.start, b.end])).toEqual([['Parte 1', 600, 630]]);
  });

  it('ignora registros de otros días', () => {
    const tasks = [task({ id: 'a', title: 'A', done: true })];
    expect(doneBlocksFor(DAY, tasks, [entry('a', 600, 660, undefined, '2026-10-14')])).toEqual([]);
  });
});
