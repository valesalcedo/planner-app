import type { AppData, Attendance, CalendarEvent, ISODate, Task } from '../types';
import { addDays, hhmmToMin, today as todayISO, tsAt } from './time';

export type ProgressInput = Pick<AppData, 'tasks' | 'entries' | 'courses' | 'weekly' | 'attendance' | 'events'>;

export interface TaskCount {
  done: number;
  total: number;
}

export interface CourseProgress extends TaskCount {
  courseId: string;
  focusMin: number;
}

export interface WeekProgress extends TaskCount {
  focusMin: number;
  /** Tareas terminadas la semana anterior, para comparar. */
  prevDone: number;
  /** Ramos con tareas o tiempo esa semana, en el orden de Ajustes. */
  courses: CourseProgress[];
}

/**
 * Tareas que cuentan en una semana: las planificadas para esos días, las que terminaste esos días
 * y, si es la semana actual, las atrasadas que siguen pendientes (porque siguen apareciendo en Hoy).
 */
export function tasksOfWeek(tasks: Task[], weekStart: ISODate, now = Date.now()): Task[] {
  const weekEnd = addDays(weekStart, 6);
  const startTs = tsAt(weekStart, 0);
  const endTs = tsAt(addDays(weekStart, 7), 0);
  const today = todayISO(new Date(now));
  const isCurrent = today >= weekStart && today <= weekEnd;
  return tasks.filter((t) => {
    if (t.done && t.doneAt !== undefined && t.doneAt >= startTs && t.doneAt < endTs) return true;
    if (t.date >= weekStart && t.date <= weekEnd) return true;
    return isCurrent && !t.done && t.date < weekStart;
  });
}

function countDone(list: Task[], endTs: number): TaskCount {
  return { done: list.filter((t) => t.done && (t.doneAt ?? 0) < endTs).length, total: list.length };
}

export function weekProgress(data: ProgressInput, weekStart: ISODate, now = Date.now()): WeekProgress {
  const startTs = tsAt(weekStart, 0);
  const endTs = tsAt(addDays(weekStart, 7), 0);
  const list = tasksOfWeek(data.tasks, weekStart, now);
  const prevStart = addDays(weekStart, -7);
  const prev = countDone(tasksOfWeek(data.tasks, prevStart, now), startTs);

  const focusByCourse = new Map<string, number>();
  let focusMin = 0;
  for (const e of data.entries) {
    if (e.end <= startTs || e.start >= endTs) continue;
    const min = (Math.min(e.end, endTs) - Math.max(e.start, startTs)) / 60000;
    focusMin += min;
    if (!e.personal && e.courseId) focusByCourse.set(e.courseId, (focusByCourse.get(e.courseId) ?? 0) + min);
  }

  const courses = data.courses
    .map((c) => ({
      courseId: c.id,
      ...countDone(
        list.filter((t) => !t.personal && t.courseId === c.id),
        endTs,
      ),
      focusMin: focusByCourse.get(c.id) ?? 0,
    }))
    .filter((c) => c.total > 0 || c.focusMin > 0);

  return { ...countDone(list, endTs), focusMin, prevDone: prev.done, courses };
}

export interface CourseDetail {
  /** Últimas clases marcadas, de la más antigua a la más reciente. */
  recentClasses: Attendance[];
  fui: number;
  marked: number;
  /** Clases seguidas a las que fuiste, contando desde la última. */
  currentRun: number;
  nextEval: CalendarEvent | null;
  pending: Task[];
}

export function courseDetail(data: ProgressInput, courseId: string, now = Date.now()): CourseDetail {
  const today = todayISO(new Date(now));
  const blocks = new Map(data.weekly.filter((b) => b.courseId === courseId).map((b) => [b.id, b]));
  const marks = Object.entries(data.attendance ?? {})
    .flatMap(([date, day]) =>
      Object.entries(day).flatMap(([blockId, mark]) => {
        const b = blocks.get(blockId);
        // Un "no voy" marcado antes de la clase cuenta recién cuando la clase termina.
        return b && tsAt(date, hhmmToMin(b.end)) <= now ? [{ key: `${date} ${b.start}`, mark }] : [];
      }),
    )
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((m) => m.mark);

  let currentRun = 0;
  for (let i = marks.length - 1; i >= 0 && marks[i] === 'fui'; i--) currentRun++;

  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const nextEval =
    data.events
      .filter(
        (e) =>
          e.courseId === courseId &&
          e.kind === 'evaluacion' &&
          (e.date > today || (e.date === today && (!e.start || hhmmToMin(e.start) >= nowMin))),
      )
      .sort((a, b) => (a.date + (a.start ?? '') < b.date + (b.start ?? '') ? -1 : 1))[0] ?? null;

  const pending = data.tasks
    .filter((t) => t.courseId === courseId && !t.personal && !t.done)
    .sort((a, b) => ((a.deadline ?? a.date) < (b.deadline ?? b.date) ? -1 : 1));

  return {
    recentClasses: marks.slice(-20),
    fui: marks.filter((m) => m === 'fui').length,
    marked: marks.length,
    currentRun,
    nextEval,
    pending,
  };
}

/** Días que faltan desde hoy hasta una fecha (0 = hoy). */
export function daysUntil(date: ISODate, now = Date.now()): number {
  return Math.round((tsAt(date, 0) - tsAt(todayISO(new Date(now)), 0)) / 86400000);
}
