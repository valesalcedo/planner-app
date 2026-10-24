import type { StarTx, Task, TimeEntry, TrashedTask } from '../types';

/** Días que una tarea borrada se queda en la papelera. */
export const TRASH_DAYS = 30;

export function isExpired(item: TrashedTask, now = Date.now()): boolean {
  return now - item.deletedAt > TRASH_DAYS * 86_400_000;
}

/** Días que le quedan en la papelera (mínimo 1 mientras siga ahí). */
export function daysLeft(item: TrashedTask, now = Date.now()): number {
  return Math.max(1, Math.ceil((item.deletedAt + TRASH_DAYS * 86_400_000 - now) / 86_400_000));
}

/** Saca el nombre de la tarea de un movimiento como `Foco en "X"` o `Tiempo agregado a "X"`. */
export function titleFromReason(reason: string): string | undefined {
  const m = /^(?:Foco en|Tiempo agregado a) "(.*)"$/.exec(reason);
  return m?.[1] || undefined;
}

/** Tarea borrada antes de que existiera la papelera, reconstruida a partir de su tiempo registrado. */
export interface LostTask {
  taskId: string;
  title?: string;
  minutes: number;
  /** Estrellas de foco que te dio ese tiempo (siguen en tu saldo). */
  stars: number;
  lastAt: number;
  entries: TimeEntry[];
}

/** Registros de tiempo cuya tarea ya no existe (ni en tu lista ni en la papelera). */
export function lostTasks(tasks: Task[], trash: TrashedTask[], entries: TimeEntry[], stars: StarTx[]): LostTask[] {
  const known = new Set([...tasks.map((t) => t.id), ...trash.map((x) => x.task.id)]);
  const starsByEntry = new Map<string, StarTx>();
  for (const t of stars) if (t.kind === 'foco' && t.ref) starsByEntry.set(t.ref, t);

  const byTask = new Map<string, LostTask>();
  for (const e of entries) {
    if (known.has(e.taskId)) continue;
    const lost = byTask.get(e.taskId) ?? { taskId: e.taskId, minutes: 0, stars: 0, lastAt: 0, entries: [] };
    const tx = starsByEntry.get(e.id);
    lost.minutes += Math.round((e.end - e.start) / 60000);
    lost.stars += tx?.amount ?? 0;
    lost.lastAt = Math.max(lost.lastAt, e.end);
    lost.title ??= tx ? titleFromReason(tx.reason) : undefined;
    lost.entries.push(e);
    byTask.set(e.taskId, lost);
  }
  return [...byTask.values()].sort((a, b) => b.lastAt - a.lastAt);
}
