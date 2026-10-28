/**
 * Ordenador automático del día.
 *
 * Toma los bloques ocupados (clases, actividades, eventos con hora) y reparte las
 * tareas pendientes en los huecos libres según tres reglas:
 *  1. Lo que vence hoy o está marcado "sí o sí hoy" va primero (tier 0).
 *  2. En huecos cortos o entre clases van tareas fáciles y breves. Si ninguna cabe entera,
 *     se agenda un trozo de lo más urgente (las difíciles solo si no queda otra cosa),
 *     para no dejar huecos vacíos.
 *  3. En huecos largos va lo más urgente y, a igual urgencia, lo más difícil.
 *     Si no cabe entero, se agenda un trozo y el resto sigue en el siguiente hueco.
 * Lo que no cabe queda en `overflow` para pasarlo a mañana.
 *
 * Además:
 *  - Los traslados (ida y vuelta a la U) cuentan como tiempo ocupado, y en ellos solo
 *    van tareas marcadas "se puede en el transporte" (primero las más urgentes).
 *  - Las tareas que arrastraste a mano quedan fijadas donde las dejaste, y el resto
 *    se reordena alrededor.
 *
 * Todas las horas son minutos desde la medianoche, así la función es pura y testeable.
 */
import type {
  Attendance,
  CalendarEvent,
  Subtask,
  Difficulty,
  ISODate,
  Settings,
  Task,
  TaskPin,
  TimeEntry,
  TravelLeg,
  TravelOverride,
  WeeklyBlock,
} from '../types';
import { addDays, hhmmToMin, minToHHMM, weekdayOf } from './time';

export interface BusyBlock {
  id: string;
  start: number;
  end: number;
  title: string;
  kind: 'clase' | 'actividad' | 'evento';
  sourceId: string;
  /** Clase a la que avisaste que no vas: se muestra, pero su tiempo queda libre. */
  free?: boolean;
}

export interface WorkUnit {
  key: string;
  taskId: string;
  subtaskId?: string;
  title: string;
  taskTitle: string;
  remainingMin: number;
  difficulty: Difficulty;
  /** 0 = vence hoy u obligatoria, 1 = vence mañana o le toca este día en el reparto, 2 = flexible. */
  tier: 0 | 1 | 2;
  /** Orden dentro de la tarea, para respetar la secuencia de subtareas. */
  order: number;
  /** Se puede hacer en el transporte. */
  onTheGo: boolean;
}

export interface TravelBlock {
  leg: TravelLeg;
  start: number;
  end: number;
  /** Lo moviste de su hora por defecto. */
  moved: boolean;
  /** Ese día lo quitaste (se muestra para poder restaurarlo, pero no ocupa tiempo). */
  removed: boolean;
}

export interface Placement {
  unit: WorkUnit;
  start: number;
  end: number;
  partial: boolean;
  /** Va dentro de este traslado. */
  travel?: TravelLeg;
  /** La dejaste fija a mano. */
  pinned?: boolean;
}

export interface FreeSlot {
  start: number;
  end: number;
  short: boolean;
}

export interface DayPlan {
  busy: BusyBlock[];
  /** Traslados del día (incluye los quitados, marcados con `removed`). */
  travel: TravelBlock[];
  slots: FreeSlot[];
  placements: Placement[];
  /** Tiempo libre que quedó sin tareas (para soltar tareas ahí). */
  gaps: { start: number; end: number }[];
  overflow: WorkUnit[];
}

export interface PlanExtras {
  travel?: TravelBlock[];
  /** Tareas fijadas: clave de la unidad → dónde. */
  pins?: Record<string, TaskPin>;
}

const DIFF_RANK: Record<Difficulty, number> = { facil: 0, media: 1, dificil: 2 };
const MIN_CHUNK = 25;
const MIN_PLACE = 10;
/** Trozo mínimo para aprovechar un hueco donde nada cabe entero. */
const MIN_FILL = 15;
const SHORT_SLOT = 60;
const BETWEEN_CLASSES_MAX = 90;

export function busyBlocksFor(
  date: ISODate,
  weekly: WeeklyBlock[],
  events: CalendarEvent[],
  skipped: Record<ISODate, string[]>,
  attendance?: Record<ISODate, Record<string, Attendance>>,
): BusyBlock[] {
  const wd = weekdayOf(date);
  const skip = new Set(skipped[date] ?? []);
  const notGoing = notGoingSet(date, attendance);
  const blocks: BusyBlock[] = weekly
    .filter((b) => b.weekday === wd && !skip.has(b.id))
    .map((b) => ({
      id: `w-${b.id}`,
      start: hhmmToMin(b.start),
      end: hhmmToMin(b.end),
      title: b.title,
      kind: b.kind,
      sourceId: b.id,
      ...(b.kind === 'clase' && notGoing.has(b.id) ? { free: true } : {}),
    }));
  for (const e of events) {
    if (e.date !== date || !e.start) continue;
    const start = hhmmToMin(e.start);
    const end = e.end ? hhmmToMin(e.end) : start + 60;
    blocks.push({ id: `e-${e.id}`, start, end, title: e.title, kind: 'evento', sourceId: e.id });
  }
  return blocks.filter((b) => b.end > b.start).sort((a, b) => a.start - b.start);
}

/** Clases de ese día marcadas como "no voy" / "falté". */
function notGoingSet(date: ISODate, attendance?: Record<ISODate, Record<string, Attendance>>): Set<string> {
  return new Set(Object.entries(attendance?.[date] ?? {}).filter(([, m]) => m === 'falte').map(([id]) => id));
}

/**
 * Traslados del día: solo los días con alguna clase a la que vas (no marcada "no hubo" ni "no voy").
 * La ida termina cuando empieza la primera clase y la vuelta parte cuando termina la última,
 * salvo que la hayas movido.
 */
export function travelBlocksFor(
  date: ISODate,
  weekly: WeeklyBlock[],
  skipped: Record<ISODate, string[]>,
  overrides: Partial<Record<TravelLeg, TravelOverride>> | undefined,
  settings: Pick<Settings, 'travelEnabled' | 'travelMin'>,
  attendance?: Record<ISODate, Record<string, Attendance>>,
): TravelBlock[] {
  if (!settings.travelEnabled || settings.travelMin <= 0) return [];
  const wd = weekdayOf(date);
  const skip = new Set(skipped[date] ?? []);
  const notGoing = notGoingSet(date, attendance);
  const classes = weekly.filter((b) => b.kind === 'clase' && b.weekday === wd && !skip.has(b.id) && !notGoing.has(b.id));
  if (classes.length === 0) return [];
  const firstStart = Math.min(...classes.map((b) => hhmmToMin(b.start)));
  const lastEnd = Math.max(...classes.map((b) => hhmmToMin(b.end)));
  const defaults: Record<TravelLeg, number> = {
    ida: Math.max(0, firstStart - settings.travelMin),
    vuelta: lastEnd,
  };
  return (['ida', 'vuelta'] as const).map((leg) => {
    const o = overrides?.[leg] ?? {};
    const start = o.start ? hhmmToMin(o.start) : defaults[leg];
    return {
      leg,
      start,
      end: start + settings.travelMin,
      moved: !!o.start,
      removed: !!o.removed,
    };
  });
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

/** Día que le toca a cada subtarea repartida entre varios días (ver spread.ts): id → fecha. */
export type SubtaskDays = Map<string, ISODate>;

/**
 * Día en que toca una subtarea pendiente: el que elegiste a mano, el del reparto o el de la tarea.
 * Lo atrasado toca hoy.
 */
export function subtaskDay(task: Task, sub: Subtask, days: SubtaskDays, today: ISODate): ISODate {
  const d = sub.date ?? days.get(sub.id) ?? task.date;
  return d > today ? d : today;
}

export function tierOf(task: Task, date: ISODate): 0 | 1 | 2 {
  if (task.mustToday && task.date <= date) return 0;
  if (task.deadline && task.deadline <= date) return 0;
  if (task.deadline && task.deadline === addDays(date, 1)) return 1;
  return 2;
}

/**
 * Tareas pendientes de ese día (incluye las atrasadas) convertidas en unidades de trabajo.
 * Las subtareas solo entran el día que les toca (`days` y `today` vienen del reparto entre días).
 */
export function buildUnits(
  tasks: Task[],
  entries: TimeEntry[],
  date: ISODate,
  opts: { days?: SubtaskDays; today?: ISODate } = {},
): WorkUnit[] {
  const { byTask, bySub } = loggedMinutes(entries);
  const days = opts.days ?? new Map();
  const today = opts.today ?? date;
  const units: WorkUnit[] = [];
  for (const t of tasks) {
    if (t.done) continue;
    const tier = tierOf(t, date);
    const pending = t.subtasks.filter((s) => !s.done);
    if (t.subtasks.length > 0 && pending.length > 0) {
      pending.forEach((s, i) => {
        if (subtaskDay(t, s, days, today) !== date) return;
        // Lo que se repartió para este día (o elegiste a mano) va antes que lo flexible.
        const planned = !!s.date || days.has(s.id);
        units.push({
          key: `${t.id}:${s.id}`,
          taskId: t.id,
          subtaskId: s.id,
          title: s.title,
          taskTitle: t.title,
          remainingMin: remaining(s.estimateMin, bySub.get(s.id) ?? 0),
          difficulty: t.difficulty,
          tier: planned && tier === 2 ? 1 : tier,
          order: i,
          onTheGo: !!t.onTheGo,
        });
      });
    } else {
      if ((t.date > today ? t.date : today) !== date) continue;
      units.push({
        key: t.id,
        taskId: t.id,
        title: t.title,
        taskTitle: t.title,
        remainingMin: remaining(t.estimateMin, byTask.get(t.id) ?? 0),
        difficulty: t.difficulty,
        tier,
        order: 0,
        onTheGo: !!t.onTheGo,
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

type Interval = { start: number; end: number };

/** Partes de `base` que no tocan ningún intervalo de `cuts`. */
function subtract(base: Interval, cuts: Interval[]): Interval[] {
  let parts: Interval[] = [{ start: base.start, end: base.end }];
  for (const c of cuts) {
    parts = parts.flatMap((p) => {
      if (c.end <= p.start || c.start >= p.end) return [p];
      const out: Interval[] = [];
      if (c.start > p.start) out.push({ start: p.start, end: c.start });
      if (c.end < p.end) out.push({ start: c.end, end: p.end });
      return out;
    });
  }
  return parts;
}

export function planDay(
  units: WorkUnit[],
  allBusy: BusyBlock[],
  settings: Pick<Settings, 'dayStart' | 'dayEnd' | 'bufferMin'>,
  fromMin = 0,
  extras: PlanExtras = {},
): DayPlan {
  const dayStart = hhmmToMin(settings.dayStart);
  const dayEnd = hhmmToMin(settings.dayEnd);
  // Las clases a las que no vas se muestran, pero no ocupan tiempo.
  const busy = allBusy.filter((b) => !b.free);
  const allTravel = extras.travel ?? [];
  const travel = allTravel.filter((t) => !t.removed);
  const pins = extras.pins ?? {};
  const pool = units.map((u) => ({ ...u }));
  const placements: Placement[] = [];
  // Una subtarea solo puede empezar si las anteriores de la misma tarea ya están agendadas.
  const isNext = (u: WorkUnit) => !pool.some((o) => o.taskId === u.taskId && o.order < u.order && o.remainingMin > 0);

  const place = (unit: WorkUnit, start: number, dur: number, extra: Partial<Placement> = {}) => {
    const partial = dur < unit.remainingMin;
    placements.push({ unit: { ...unit }, start, end: start + dur, partial, ...extra });
    unit.remainingMin -= dur;
  };

  /** Llena un tramo con tareas (las mejores primero), partiéndolas si hace falta. */
  const fill = (
    slot: Interval,
    candidates: (u: WorkUnit) => boolean,
    extra: Partial<Placement>,
    shortSlot = false,
    /** Lo que fijaste a mano se respeta aunque haya subtareas anteriores pendientes. */
    anyOrder = false,
  ) => {
    let cursor = slot.start;
    while (slot.end - cursor >= MIN_PLACE) {
      const avail = slot.end - cursor;
      const open = pool.filter((u) => u.remainingMin > 0 && (anyOrder || isNext(u)) && candidates(u));
      if (open.length === 0) break;

      let unit: WorkUnit | undefined;
      let dur = 0;
      if (shortSlot) {
        // Lo ideal: algo fácil o medio que quepa entero.
        unit = open.filter((u) => u.difficulty !== 'dificil' && u.remainingMin <= avail).sort(byEase)[0];
        dur = unit?.remainingMin ?? 0;
        // Si nada cabe entero, igual se aprovecha el hueco con un trozo de lo más urgente
        // (primero lo que no es difícil).
        if (!unit && avail >= MIN_FILL) {
          const easy = open.filter((u) => u.difficulty !== 'dificil').sort(byUrgency);
          unit = (easy.length > 0 ? easy : [...open].sort(byUrgency))[0];
          dur = Math.min(unit.remainingMin, avail);
        }
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
          // Nada cabe entero en lo que queda: un trozo de lo más urgente.
          if (!unit && avail >= MIN_FILL) {
            unit = top;
            dur = avail;
          }
        }
      }
      if (!unit) break;
      place(unit, cursor, dur, extra);
      cursor += dur + settings.bufferMin;
    }
    return cursor;
  };

  // Parte del traslado que todavía no pasa.
  const travelLive = travel
    .map((t) => ({ t, start: Math.max(t.start, fromMin), end: t.end }))
    .filter((x) => x.end - x.start >= MIN_PLACE);

  // 1. Tareas fijadas a una hora: van donde las dejaste. Si chocan con otra fijada, justo después.
  //    No se pasan del bloque ocupado (o traslado) siguiente; lo que falte se agenda en otro hueco.
  const pinnedIntervals: Interval[] = [];
  const timePins = Object.entries(pins)
    .flatMap(([key, pin]) => ('at' in pin ? [{ key, at: hhmmToMin(pin.at) }] : []))
    .filter((p) => p.at >= fromMin)
    .sort((a, b) => a.at - b.at);
  const obstacles: Interval[] = [...busy, ...travel].map((b) => ({ start: b.start, end: b.end }));
  for (const { key, at } of timePins) {
    const unit = pool.find((u) => u.key === key && u.remainingMin > 0);
    if (!unit) continue;
    let start = at;
    // No encima de una clase ni de otra tarea fijada.
    for (let moved = true; moved; ) {
      moved = false;
      for (const b of [...busy, ...pinnedIntervals.map((p) => ({ ...p, end: p.end + settings.bufferMin }))]) {
        if (start >= b.start && start < b.end) {
          start = b.end;
          moved = true;
        }
      }
    }
    const inTravel = travelLive.find((x) => start >= x.t.start && start < x.t.end);
    const limit = inTravel
      ? inTravel.t.end
      : Math.min(...obstacles.filter((o) => o.start > start).map((o) => o.start), Math.max(dayEnd, start + unit.remainingMin));
    const dur = Math.min(unit.remainingMin, limit - start);
    if (dur < 1) continue;
    place(unit, start, dur, { pinned: true, travel: inTravel?.t.leg });
    pinnedIntervals.push({ start, end: start + dur });
  }

  // 2. Traslados: primero lo que arrastraste ahí, después lo marcado para el transporte.
  for (const { t, start, end } of travelLive) {
    const free = subtract({ start, end }, pinnedIntervals);
    const pinnedHere = Object.entries(pins)
      .filter(([, pin]) => 'travel' in pin && pin.travel === t.leg)
      .map(([key]) => key);
    for (const part of free) {
      const cursor = fill(part, (u) => pinnedHere.includes(u.key), { travel: t.leg, pinned: true }, false, true);
      fill({ start: cursor, end: part.end }, (u) => u.onTheGo, { travel: t.leg });
    }
  }

  // 3. El resto del día, con los traslados y lo fijado como ocupado.
  const blocking: BusyBlock[] = [
    ...busy,
    ...travel.map((t) => ({ id: `t-${t.leg}`, start: t.start, end: t.end, title: '', kind: 'actividad' as const, sourceId: t.leg })),
    ...pinnedIntervals.map((p, i) => ({ id: `p-${i}`, start: p.start, end: p.end + settings.bufferMin, title: '', kind: 'actividad' as const, sourceId: '' })),
  ];
  const slots = freeSlots(blocking, dayStart, dayEnd, fromMin);
  for (const slot of slots) fill(slot, () => true, {}, slot.short);

  placements.sort((a, b) => a.start - b.start);

  const gaps = slots
    .flatMap((slot) =>
      subtract(
        slot,
        placements.map((p) => ({ start: p.start, end: p.end + settings.bufferMin })),
      ),
    )
    .filter((g) => g.end - g.start >= 15);

  const overflow = pool.filter((u) => u.remainingMin > 0);
  return { busy: allBusy, travel: allTravel, slots, placements, gaps, overflow };
}

/** Clave con que se fija una unidad de trabajo. */
export const unitKey = (taskId: string, subtaskId?: string) => (subtaskId ? `${taskId}:${subtaskId}` : taskId);

export const pinAt = (min: number): TaskPin => ({ at: minToHHMM(min) });
