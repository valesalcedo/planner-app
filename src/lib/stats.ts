import type { AppData, ISODate } from '../types';
import { earnedBetween } from './rewards';
import { addDays, hhmmToMin, tsAt, weekdayOf } from './time';

export const NO_COURSE = '__sin_ramo__';

export interface WeekStats {
  days: ISODate[];
  /** Minutos de foco cronometrados por día (lunes a domingo). */
  focusByDay: number[];
  focusTotal: number;
  classTotal: number;
  tasksDone: number;
  starsEarned: number;
  /** Minutos registrados / minutos estimados de las tareas terminadas con registro. Null si no hay datos. */
  estimateRatio: number | null;
  /** Carga académica: ramo → tipo de actividad → minutos. */
  load: Map<string, Map<string, number>>;
  attendance: AttendanceStats;
}

export interface AttendanceCount {
  /** Clases que ya pasaron (sin contar las que no hubo). */
  total: number;
  fui: number;
  falte: number;
}

export interface AttendanceStats extends AttendanceCount {
  /** Por ramo (NO_COURSE para clases sin ramo). */
  byCourse: Map<string, AttendanceCount>;
}

function addLoad(load: Map<string, Map<string, number>>, course: string, activity: string, min: number) {
  if (min <= 0) return;
  const row = load.get(course) ?? new Map<string, number>();
  row.set(activity, (row.get(activity) ?? 0) + min);
  load.set(course, row);
}

export type StatsInput = Pick<AppData, 'entries' | 'tasks' | 'weekly' | 'skipped' | 'events' | 'stars'> &
  Partial<Pick<AppData, 'attendance'>>;

/**
 * Estadísticas de la semana que empieza el lunes `weekStart`.
 * Las clases del horario semanal que ya pasaron cuentan como asistidas, salvo que estén
 * marcadas como "no hubo clase" o "falté". Las evaluaciones con hora también suman.
 */
export function weekStats(data: StatsInput, weekStart: ISODate, now = Date.now()): WeekStats {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startTs = tsAt(weekStart, 0);
  const endTs = tsAt(addDays(weekStart, 7), 0);
  const load = new Map<string, Map<string, number>>();
  const focusByDay = Array(7).fill(0) as number[];

  for (const e of data.entries) {
    if (e.end <= startTs || e.start >= endTs) continue;
    const min = (Math.min(e.end, endTs) - Math.max(e.start, startTs)) / 60000;
    const dayIdx = Math.min(6, Math.floor((Math.max(e.start, startTs) - startTs) / 86400000));
    focusByDay[dayIdx] += min;
    addLoad(load, e.courseId ?? NO_COURSE, e.activityId, min);
  }

  let classTotal = 0;
  const attendance: AttendanceStats = { total: 0, fui: 0, falte: 0, byCourse: new Map() };
  for (const day of days) {
    const skip = new Set(data.skipped[day] ?? []);
    for (const b of data.weekly) {
      if (b.kind !== 'clase' || b.weekday !== weekdayOf(day) || skip.has(b.id)) continue;
      const endMin = hhmmToMin(b.end);
      if (tsAt(day, endMin) > now) continue;
      const mark = data.attendance?.[day]?.[b.id];
      const key = b.courseId ?? NO_COURSE;
      const c = attendance.byCourse.get(key) ?? { total: 0, fui: 0, falte: 0 };
      for (const a of [attendance, c]) {
        a.total++;
        if (mark === 'fui') a.fui++;
        if (mark === 'falte') a.falte++;
      }
      attendance.byCourse.set(key, c);
      if (mark === 'falte') continue;
      const min = endMin - hhmmToMin(b.start);
      classTotal += min;
      addLoad(load, b.courseId ?? NO_COURSE, b.activityId ?? 'catedra', min);
    }
    for (const ev of data.events) {
      if (ev.date !== day || ev.kind !== 'evaluacion' || !ev.start) continue;
      const s = hhmmToMin(ev.start);
      const end = ev.end ? hhmmToMin(ev.end) : s + 60;
      if (tsAt(day, end) > now) continue;
      addLoad(load, ev.courseId ?? NO_COURSE, 'evaluacion', end - s);
    }
  }

  const doneTasks = data.tasks.filter((t) => t.done && t.doneAt && t.doneAt >= startTs && t.doneAt < endTs);
  let logged = 0;
  let estimated = 0;
  for (const t of doneTasks) {
    const min = data.entries.filter((e) => e.taskId === t.id).reduce((s, e) => s + (e.end - e.start) / 60000, 0);
    if (min > 0) {
      logged += min;
      estimated += t.estimateMin;
    }
  }

  const starsEarned = earnedBetween(data.stars, startTs, endTs);

  return {
    days,
    focusByDay,
    focusTotal: focusByDay.reduce((a, b) => a + b, 0),
    classTotal,
    tasksDone: doneTasks.length,
    starsEarned,
    estimateRatio: estimated > 0 ? logged / estimated : null,
    load,
    attendance,
  };
}

/** Texto plano de la carga académica, listo para copiar. */
export function loadAsText(
  load: WeekStats['load'],
  courseName: (id: string) => string,
  activityName: (id: string) => string,
  label: string,
): string {
  const lines = [`Carga académica · ${label}`];
  for (const [course, row] of load) {
    const total = [...row.values()].reduce((a, b) => a + b, 0);
    lines.push('', `${courseName(course)}: ${(total / 60).toFixed(1)} h`);
    for (const [act, min] of row) lines.push(`  · ${activityName(act)}: ${(min / 60).toFixed(1)} h`);
  }
  return lines.join('\n');
}
