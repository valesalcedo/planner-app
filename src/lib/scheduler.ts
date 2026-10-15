/**
 * Ordenador automático del día.
 *
 * Toma los bloques ocupados (clases, actividades, eventos con hora) y reparte las
 * tareas pendientes en los huecos libres según tres reglas:
 *  1. Lo que vence hoy o está marcado "sí o sí hoy" va primero (tier 0).
 *  2. En huecos cortos o entre clases van tareas fáciles y breves; nunca las difíciles.
 *  3. En huecos largos va lo más urgente y, a igual urgencia, lo más difícil.
 *     Si no cabe entero, se agenda un trozo y el resto sigue en el siguiente hueco.
 * Lo que no cabe queda en `overflow` para pasarlo a mañana.
 *
 * Todas las horas son minutos desde la medianoche, así la función es pura y testeable.
 */
import type { CalendarEvent, Difficulty, ISODate, Settings, Task, TimeEntry, WeeklyBlock } from '../types';
import { addDays, hhmmToMin, weekdayOf } from './time';

export interface BusyBlock {
  id: string;
  start: number;
  end: number;
  title: string;
  kind: 'clase' | 'actividad' | 'evento';
  sourceId: string;
}

export interface WorkUnit {
  key: string;
  taskId: string;
  subtaskId?: string;
  title: string;
  taskTitle: string;
  remainingMin: number;
  difficulty: Difficulty;
  /** 0 = vence hoy u obligatoria, 1 = vence mañana, 2 = flexible. */
  tier: 0 | 1 | 2;
  /** Orden dentro de la tarea, para respetar la secuencia de subtareas. */
  order: number;
}

export interface Placement {
  unit: WorkUnit;
  start: number;
  end: number;
  partial: boolean;
}

export interface FreeSlot {
  start: number;
  end: number;
  short: boolean;
}

export interface DayPlan {
  busy: BusyBlock[];
  slots: FreeSlot[];
  placements: Placement[];
  overflow: WorkUnit[];
}

const DIFF_RANK: Record<Difficulty, number> = { facil: 0, media: 1, dificil: 2 };
const MIN_CHUNK = 25;
const MIN_PLACE = 10;
const SHORT_SLOT = 60;
const BETWEEN_CLASSES_MAX = 90;

export function busyBlocksFor(
  date: ISODate,
  weekly: WeeklyBlock[],
  events: CalendarEvent[],
  skipped: Record<ISODate, string[]>,
): BusyBlock[] {
  const wd = weekdayOf(date);
  const skip = new Set(skipped[date] ?? []);
  const blocks: BusyBlock[] = weekly
    .filter((b) => b.weekday === wd && !skip.has(b.id))
    .map((b) => ({
      id: `w-${b.id}`,
      start: hhmmToMin(b.start),
      end: hhmmToMin(b.end),
      title: b.title,
      kind: b.kind,
      sourceId: b.id,
    }));
  for (const e of events) {
    if (e.date !== date || !e.start) continue;
    const start = hhmmToMin(e.start);
    const end = e.end ? hhmmToMin(e.end) : start + 60;
    blocks.push({ id: `e-${e.id}`, start, end, title: e.title, kind: 'evento', sourceId: e.id });
  }
  return blocks.filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
}

export function freeSlots(busy: BusyBlock[], dayStart: number, dayEnd: number, from: number): FreeSlot[] {
  const start = Math.max(dayStart, from);
  const slots: FreeSlot[] = [];
  let cursor = start;
  let prevWasBusy = false;
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  for (const b of sorted) {
    if (b.end <= cursor) {
      if (b.end === cursor) prevWasBusy = true;
      continue;
    }
    if (b.start > cursor) {
      const end = Math.min(b.start, dayEnd);
      if (end > cursor) slots.push(makeSlot(cursor, end, prevWasBusy, true));
    }
    cursor = Math.max(cursor, b.end);
    prevWasBusy = true;
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) slots.push(makeSlot(cursor, dayEnd, prevWasBusy, false));
  return slots.filter((s) => s.end - s.start >= MIN_PLACE);
}

function makeSlot(start: number, end: number, busyBefore: boolean, busyAfter: boolean): FreeSlot {
  const len = end - start;
  const betweenClasses = busyBefore && busyAfter && len <= BETWEEN_CLASSES_MAX;
  return { start, end, short: len < SHORT_SLOT || betweenClasses };
}

/** Minutos registrados por tarea y por subtarea. */
export function loggedMinutes(entries: TimeEntry[]): { byTask: Map<string, number>; bySub: Map<string, number> } {
  const byTask = new Map<string, number>();
  const bySub = new Map<string, number>();
  for (const e of entries) {
    const min = (e.end - e.start) / 60000;
    byTask.set(e.taskId, (byTask.get(e.taskId) ?? 0) + min);
    if (e.subtaskId) bySub.set(e.subtaskId, (bySub.get(e.subtaskId) ?? 0) + min);
  }
  return { byTask, bySub };
}

export function tierOf(task: Task, date: ISODate): 0 | 1 | 2 {
  if (task.mustToday && task.date <= date) return 0;
  if (task.deadline && task.deadline <= date) return 0;
  if (task.deadline && task.deadline === addDays(date, 1)) return 1;
  return 2;
}

/** Tareas pendientes de ese día (incluye las atrasadas) convertidas en unidades de trabajo. */
export function buildUnits(tasks: Task[], entries: TimeEntry[], date: ISODate): WorkUnit[] {
  const { byTask, bySub } = loggedMinutes(entries);
  const units: WorkUnit[] = [];
  for (const t of tasks) {
    if (t.done || t.date > date) continue;
    const tier = tierOf(t, date);
    const pending = t.subtasks.filter((s) => !s.done);
    if (t.subtasks.length > 0 && pending.length > 0) {
      pending.forEach((s, i) => {
        units.push({
          key: `${t.id}:${s.id}`,
          taskId: t.id,
          subtaskId: s.id,
          title: s.title,
          taskTitle: t.title,
          remainingMin: remaining(s.estimateMin, bySub.get(s.id) ?? 0),
          difficulty: t.difficulty,
          tier,
          order: i,
        });
      });
    } else {
      units.push({
        key: t.id,
        taskId: t.id,
        title: t.title,
        taskTitle: t.title,
        remainingMin: remaining(t.estimateMin, byTask.get(t.id) ?? 0),
        difficulty: t.difficulty,
        tier,
        order: 0,
      });
    }
  }
  return units;
}

function remaining(estimate: number, logged: number): number {
  const left = Math.round(estimate - logged);
  return left >= 5 ? left : 15;
}

const byUrgency = (a: WorkUnit, b: WorkUnit) =>
  a.tier - b.tier ||
  DIFF_RANK[b.difficulty] - DIFF_RANK[a.difficulty] ||
  a.order - b.order ||
  a.remainingMin - b.remainingMin;

const byEase = (a: WorkUnit, b: WorkUnit) =>
  DIFF_RANK[a.difficulty] - DIFF_RANK[b.difficulty] ||
  a.tier - b.tier ||
  a.remainingMin - b.remainingMin ||
  a.order - b.order;

export function planDay(
  units: WorkUnit[],
  busy: BusyBlock[],
  settings: Pick<Settings, 'dayStart' | 'dayEnd' | 'bufferMin'>,
  fromMin = 0,
): DayPlan {
  const slots = freeSlots(busy, hhmmToMin(settings.dayStart), hhmmToMin(settings.dayEnd), fromMin);
  const pool = units.map((u) => ({ ...u }));
  const placements: Placement[] = [];
  // Una subtarea solo puede empezar si las anteriores de la misma tarea ya están agendadas.
  const isNext = (u: WorkUnit) => !pool.some((o) => o.taskId === u.taskId && o.order < u.order && o.remainingMin > 0);

  for (const slot of slots) {
    let cursor = slot.start;
    while (slot.end - cursor >= MIN_PLACE) {
      const avail = slot.end - cursor;
      const open = pool.filter((u) => u.remainingMin > 0 && isNext(u));
      if (open.length === 0) break;

      let unit: WorkUnit | undefined;
      let dur = 0;
      if (slot.short) {
        unit = open.filter((u) => u.difficulty !== 'dificil' && u.remainingMin <= avail).sort(byEase)[0];
        dur = unit?.remainingMin ?? 0;
      } else {
        const sorted = [...open].sort(byUrgency);
        const top = sorted[0];
        if (top.remainingMin <= avail) {
          unit = top;
          dur = top.remainingMin;
        } else if (avail >= MIN_CHUNK) {
          unit = top;
          dur = avail;
        } else {
          unit = sorted.find((u) => u.remainingMin <= avail);
          dur = unit?.remainingMin ?? 0;
        }
      }
      if (!unit) break;

      const partial = dur < unit.remainingMin;
      placements.push({ unit: { ...unit }, start: cursor, end: cursor + dur, partial });
      unit.remainingMin -= dur;
      cursor += dur + settings.bufferMin;
    }
  }

  const overflow = pool.filter((u) => u.remainingMin > 0);
  return { busy, slots, placements, overflow };
}
