/**
 * Bloques de trabajo ya hecho para mostrar en "Mi día".
 *
 * Cuando marcas una tarea (o subtarea) como hecha, no desaparece del horario:
 * se queda en las horas en que la trabajaste (según los registros de tiempo),
 * tachada. Registros seguidos de la misma tarea se juntan en un solo bloque.
 */
import type { ISODate, Task, TimeEntry } from '../types';
import { addDays, tsAt } from './time';

export interface DoneBlock {
  key: string;
  taskId: string;
  subtaskId?: string;
  title: string;
  taskTitle: string;
  /** Minutos desde la medianoche del día mostrado. */
  start: number;
  end: number;
}

/** Registros separados por menos que esto (pausas cortas) se juntan en un bloque. */
const MERGE_GAP_MIN = 5;

export function doneBlocksFor(date: ISODate, tasks: Task[], entries: TimeEntry[]): DoneBlock[] {
  const dayStart = tsAt(date, 0);
  const dayEnd = tsAt(addDays(date, 1), 0);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const pieces: DoneBlock[] = [];
  for (const e of entries) {
    if (e.end <= dayStart || e.start >= dayEnd) continue;
    const task = taskById.get(e.taskId);
    if (!task) continue;
    const sub = e.subtaskId ? task.subtasks.find((s) => s.id === e.subtaskId) : undefined;
    const isDone = task.done || (sub?.done ?? false);
    if (!isDone) continue;
    const start = (Math.max(e.start, dayStart) - dayStart) / 60000;
    const end = (Math.min(e.end, dayEnd) - dayStart) / 60000;
    if (end - start < 1) continue;
    pieces.push({
      key: sub ? `${task.id}:${sub.id}` : task.id,
      taskId: task.id,
      subtaskId: sub?.id,
      title: sub?.title ?? task.title,
      taskTitle: task.title,
      start: Math.round(start),
      end: Math.round(end),
    });
  }

  pieces.sort((a, b) => a.start - b.start);
  const merged: DoneBlock[] = [];
  for (const p of pieces) {
    const prev = [...merged].reverse().find((m) => m.key === p.key);
    if (prev && p.start - prev.end <= MERGE_GAP_MIN && !merged.some((m) => m !== prev && m.start >= prev.end && m.start < p.start)) {
      prev.end = Math.max(prev.end, p.end);
    } else {
      merged.push({ ...p });
    }
  }
  return merged;
}
