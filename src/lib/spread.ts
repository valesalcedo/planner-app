/**
 * Reparto de subtareas entre días.
 *
 * Una tarea con fecha de inicio ("Hacer el día") y fecha de entrega, y con subtareas, no se
 * hace toda el primer día: sus subtareas se reparten entre los días que hay para avanzarla.
 *  - Se empieza el primer día y el avance va parejo: un día recibe algo solo si vas atrasada
 *    respecto de la parte que corresponde (si son 3 días, un tercio por día). Así, con pocas
 *    subtareas y muchos días, quedan espaciadas y con días libres antes de la entrega.
 *  - Un día solo recibe lo que cabe en su tiempo libre (descontando clases, traslados y las
 *    otras tareas de ese día). Lo que no cabe pasa a los días siguientes.
 *  - El último día recibe todo lo que quede, quepa o no.
 *  - Las subtareas con un día elegido a mano se quedan en ese día.
 *  - Se recalcula cada vez desde hoy: lo que no alcanzaste a hacer se vuelve a repartir
 *    entre los días que quedan.
 */
import type { CalendarEvent, ISODate, Settings, Task, TimeEntry, TravelLeg, TravelOverride, WeeklyBlock } from '../types';
import { type SubtaskDays, busyBlocksFor, freeSlots, loggedMinutes, subtaskDay, travelBlocksFor } from './scheduler';
import { addDays, hhmmToMin } from './time';

export { type SubtaskDays, subtaskDay };

export interface SpreadContext {
  today: ISODate;
  /** Minutos del día de hoy que ya pasaron. */
  nowMin: number;
  entries: TimeEntry[];
  weekly: WeeklyBlock[];
  events: CalendarEvent[];
  skipped: Record<ISODate, string[]>;
  travel: Record<ISODate, Partial<Record<TravelLeg, TravelOverride>>>;
  settings: Pick<Settings, 'dayStart' | 'dayEnd' | 'bufferMin' | 'travelEnabled' | 'travelMin'>;
}

const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b);

/** La tarea se reparte entre varios días. */
export function isSpread(t: Task): boolean {
  return !t.done && !t.mustToday && !!t.deadline && t.deadline > t.date && t.subtasks.some((s) => !s.done);
}

/** Días en que hay algo pendiente de la tarea (para mostrarla en esos días). */
export function taskDays(task: Task, days: SubtaskDays, today: ISODate): ISODate[] {
  if (task.done) return [task.date];
  const pending = task.subtasks.filter((s) => !s.done);
  if (pending.length === 0) return [maxDate(task.date, today)];
  return [...new Set(pending.map((s) => subtaskDay(task, s, days, today)))].sort();
}

/** La tarea tiene subtareas pendientes en más de un día. */
export function isSplit(task: Task, days: SubtaskDays, today: ISODate): boolean {
  return taskDays(task, days, today).length > 1;
}

/** Minutos estimados de la tarea para ese día (solo sus subtareas de ese día, si se reparte). */
export function minutesOn(task: Task, date: ISODate, days: SubtaskDays, today: ISODate): number {
  if (task.done || !isSplit(task, days, today)) return task.estimateMin;
  return task.subtasks
    .filter((s) => !s.done && subtaskDay(task, s, days, today) === date)
    .reduce((sum, s) => sum + s.estimateMin, 0);
}

function remainingMin(estimate: number, logged: number): number {
  const left = Math.round(estimate - logged);
  return left >= 5 ? left : 15;
}

/** Minutos libres de un día (sin clases, eventos ni traslados). */
function freeMinutes(date: ISODate, ctx: SpreadContext): number {
  const busy = busyBlocksFor(date, ctx.weekly, ctx.events, ctx.skipped);
  const travel = travelBlocksFor(date, ctx.weekly, ctx.skipped, ctx.travel[date], ctx.settings)
    .filter((t) => !t.removed)
    .map((t) => ({ id: `t-${t.leg}`, start: t.start, end: t.end, title: '', kind: 'actividad' as const, sourceId: t.leg }));
  const from = date === ctx.today ? ctx.nowMin : 0;
  const slots = freeSlots([...busy, ...travel], hhmmToMin(ctx.settings.dayStart), hhmmToMin(ctx.settings.dayEnd), from);
  return slots.reduce((s, x) => s + Math.max(0, x.end - x.start - ctx.settings.bufferMin), 0);
}

export function spreadSubtasks(tasks: Task[], ctx: SpreadContext): SubtaskDays {
  const days: SubtaskDays = new Map();
  const { byTask, bySub } = loggedMinutes(ctx.entries);
  const load = new Map<ISODate, number>();
  const addLoad = (d: ISODate, min: number) => load.set(d, (load.get(d) ?? 0) + min);
  const freeCache = new Map<ISODate, number>();
  const capacity = (d: ISODate) => {
    if (!freeCache.has(d)) freeCache.set(d, freeMinutes(d, ctx));
    return freeCache.get(d)! - (load.get(d) ?? 0);
  };

  // 1. Lo que ya tiene día: tareas sin reparto y subtareas elegidas a mano.
  const spread = tasks.filter(isSpread);
  for (const t of tasks) {
    if (t.done) continue;
    const pending = t.subtasks.filter((s) => !s.done);
    if (pending.length === 0) {
      addLoad(maxDate(t.date, ctx.today), remainingMin(t.estimateMin, byTask.get(t.id) ?? 0));
      continue;
    }
    const auto = spread.includes(t);
    for (const s of pending) {
      if (auto && !s.date) continue;
      addLoad(maxDate(s.date ?? t.date, ctx.today), remainingMin(s.estimateMin, bySub.get(s.id) ?? 0));
    }
  }

  // 2. Las tareas repartidas, primero las que se entregan antes.
  spread.sort((a, b) => a.deadline!.localeCompare(b.deadline!) || a.createdAt - b.createdAt);
  for (const t of spread) {
    const rest = t.subtasks
      .filter((s) => !s.done && !s.date)
      .map((s) => ({ id: s.id, min: remainingMin(s.estimateMin, bySub.get(s.id) ?? 0) }));
    if (rest.length === 0) continue;

    const first = maxDate(t.date, ctx.today);
    const last = maxDate(t.deadline!, first);
    const range: ISODate[] = [];
    for (let d = first; d <= last; d = addDays(d, 1)) range.push(d);

    const total = rest.reduce((s, x) => s + x.min, 0);
    let done = 0;
    range.forEach((d, i) => {
      if (rest.length === 0) return;
      const isLast = i === range.length - 1;
      // Lo que debería llevarse hecho al terminar este día, si el avance fuera parejo.
      const target = (total * (i + 1)) / range.length;
      let used = 0;
      while (rest.length > 0) {
        const { id, min } = rest[0];
        if (!isLast) {
          if (min > capacity(d)) break;
          // Si vas al día (o adelantada), este día no recibe nada.
          if (done >= target) break;
          // Si ya recibió algo, otra subtarea más solo si la mitad cae dentro de lo que toca.
          if (used > 0 && done + min / 2 > target) break;
        }
        days.set(id, d);
        rest.shift();
        done += min;
        used += min;
        addLoad(d, min);
      }
    });
  }
  return days;
}
