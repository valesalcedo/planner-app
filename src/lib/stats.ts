import type { AppData, ISODate } from '../types';
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
}

function addLoad(load: Map<string, Map<string, number>>, course: string, activity: string, min: number) {
  if (min <= 0) return;
  const row = load.get(course) ?? new Map<string, number>();
  row.set(activity, (row.get(activity) ?? 0) + min);
  load.set(course, row);
}

export type StatsInput = Pick<AppData, 'entries' | 'tasks' | 'weekly' | 'skipped' | 'events' | 'stars'>;

/**
 * Estadísticas de la semana que empieza el lunes `weekStart`.
 * Las clases del horario semanal cuentan como asistidas hasta `now`, salvo que estén
 * marcadas como "no hubo clase" ese día. Las evaluaciones con hora también suman.
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
  for (const day of days) {
    const skip = new Set(data.skipped[day] ?? []);
    for (const b of data.weekly) {
      if (b.kind !== 'clase' || b.weekday !== weekdayOf(day) || skip.has(b.id)) continue;
      const endMin = hhmmToMin(b.end);
      if (tsAt(day, endMin) > now) continue;
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

  const starsEarned = data.stars
    .filter((s) => s.amount > 0 && s.at >= startTs && s.at < endTs)
    .reduce((sum, s) => sum + s.amount, 0);

  return {
    days,
    focusByDay,
    focusTotal: focusByDay.reduce((a, b) => a + b, 0),
    classTotal,
    tasksDone: doneTasks.length,
    starsEarned,
    estimateRatio: estimated > 0 ? logged / estimated : null,
    load,
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
