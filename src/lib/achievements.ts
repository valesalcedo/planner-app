import type { AppData, ISODate, Task, Voice } from '../types';
import { balanceOf, isRedemption } from './rewards';
import { addDays, hhmmToMin, startOfWeek, toISODate, today as todayISO, tsAt, weekdayOf } from './time';

export type AchievementGroup = 'clases' | 'foco' | 'tareas' | 'rachas' | 'ramos' | 'habitos';

export const GROUPS: { id: AchievementGroup; title: string }[] = [
  { id: 'clases', title: 'Ir a clases' },
  { id: 'foco', title: 'Foco' },
  { id: 'tareas', title: 'Tareas' },
  { id: 'rachas', title: 'Rachas' },
  { id: 'ramos', title: 'Ramos' },
  { id: 'habitos', title: 'Hábitos' },
];

export interface Tier {
  /** Valor que hay que alcanzar. */
  goal: number;
  /** Estrellas que da (0 = solo la medalla). */
  stars: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  group: AchievementGroup;
  /** Uno o más niveles (bronce, plata, oro…), de menor a mayor. */
  tiers: Tier[];
  /** Cómo mostrar el avance (por ejemplo "7 de 10 clases"). */
  unit?: string;
  /** Nombre en masculino, para quien eligió que la app le hable así. */
  titleM?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'presente', group: 'clases', title: 'Presente', desc: 'Marca tu primera asistencia', tiers: [{ goal: 1, stars: 10 }] },
  { id: 'semana-perfecta', group: 'clases', title: 'Semana perfecta', desc: 'Ve a todas las clases de un ramo en una semana', tiers: [{ goal: 1, stars: 50 }] },
  { id: 'racha-asistencia', group: 'clases', title: 'Racha de asistencia', desc: 'Clases seguidas sin faltar', unit: 'clases', tiers: [{ goal: 10, stars: 50 }, { goal: 25, stars: 120 }, { goal: 50, stars: 300 }] },
  { id: 'madrugadora', group: 'clases', title: 'Madrugadora', titleM: 'Madrugador', desc: 'Ve a 10 clases que empiezan a las 8:30 o antes', unit: 'clases', tiers: [{ goal: 10, stars: 80 }] },

  { id: 'primer-sprint', group: 'foco', title: 'Primer sprint', desc: 'Tu primera sesión con el cronómetro', tiers: [{ goal: 1, stars: 10 }] },
  { id: 'zona-foco', group: 'foco', title: 'Zona de foco', desc: '90 minutos seguidos con el cronómetro', unit: 'min', tiers: [{ goal: 90, stars: 40 }] },
  { id: 'horas', group: 'foco', title: 'Horas acumuladas', desc: 'Horas de foco en total', unit: 'h', tiers: [{ goal: 10, stars: 50 }, { goal: 50, stars: 200 }, { goal: 100, stars: 500 }] },
  { id: 'dia-productivo', group: 'foco', title: 'Día productivo', desc: 'Trabaja todas las horas que planificaste en un día', tiers: [{ goal: 1, stars: 30 }] },

  { id: 'check', group: 'tareas', title: 'Check', desc: 'Termina tu primera tarea', tiers: [{ goal: 1, stars: 10 }] },
  { id: 'a-tiempo', group: 'tareas', title: 'A tiempo', desc: 'Tareas terminadas antes de su fecha de entrega', unit: 'tareas', tiers: [{ goal: 10, stars: 40 }, { goal: 30, stars: 120 }, { goal: 75, stars: 300 }] },
  { id: 'dia-limpio', group: 'tareas', title: 'Día limpio', desc: 'Termina todas las tareas de un día (al menos 2)', tiers: [{ goal: 1, stars: 30 }] },
  { id: 'sin-dejar', group: 'tareas', title: 'Sin dejar para mañana', desc: 'Una semana sin pasar tareas al día siguiente (al menos 5)', tiers: [{ goal: 1, stars: 100 }] },
  { id: 'paso-a-paso', group: 'tareas', title: 'Paso a paso', desc: 'Termina a tiempo una tarea con varias subtareas', tiers: [{ goal: 1, stars: 50 }] },

  { id: 'constante', group: 'rachas', title: 'Constante', desc: 'Días seguidos con todas tus tareas hechas', unit: 'días', tiers: [{ goal: 3, stars: 20 }, { goal: 7, stars: 60 }, { goal: 14, stars: 150 }, { goal: 30, stars: 400 }] },
  { id: 'finde-activo', group: 'rachas', title: 'Fin de semana activo', desc: 'Avanza algo el sábado y el domingo', tiers: [{ goal: 1, stars: 30 }] },

  { id: 'ramo-100', group: 'ramos', title: 'Ramo al 100%', desc: 'Todas las tareas de un ramo en una semana (al menos 2)', tiers: [{ goal: 1, stars: 60 }] },
  { id: 'preparada', group: 'ramos', title: 'Preparada', titleM: 'Preparado', desc: 'Termina tus tareas de estudio antes de una evaluación', tiers: [{ goal: 1, stars: 80 }] },
  { id: 'equilibrio', group: 'ramos', title: 'Equilibrio', desc: 'Avanza en todos tus ramos la misma semana', tiers: [{ goal: 1, stars: 50 }] },

  { id: 'encuestada', group: 'habitos', title: 'Encuestada', titleM: 'Encuestado', desc: 'Copia tu carga académica 4 semanas seguidas', unit: 'semanas', tiers: [{ goal: 4, stars: 60 }] },
  { id: 'viaje', group: 'habitos', title: 'Aprovecha el viaje', desc: 'Termina 10 tareas para el transporte', unit: 'tareas', tiers: [{ goal: 10, stars: 50 }] },
  { id: 'primer-gustito', group: 'habitos', title: 'Primer gustito', desc: 'Canjea tu primer premio en la tienda', tiers: [{ goal: 1, stars: 0 }] },
  { id: 'ahorradora', group: 'habitos', title: 'Ahorradora', titleM: 'Ahorrador', desc: 'Junta 1.000 estrellas sin gastarlas', unit: 'estrellas', tiers: [{ goal: 1000, stars: 100 }] },
];

/** Nombre del logro según cómo quiere que le hable la app. */
export function titleFor(def: Pick<AchievementDef, 'title' | 'titleM'>, voice: Voice): string {
  return voice === 'masculino' && def.titleM ? def.titleM : def.title;
}

export const TIER_NAMES = ['Bronce', 'Plata', 'Oro', 'Diamante'];

export type AchievementInput = Pick<
  AppData,
  'tasks' | 'entries' | 'weekly' | 'skipped' | 'attendance' | 'events' | 'courses' | 'stars' | 'surveyWeeks'
>;

const endOfDay = (d: ISODate) => tsAt(addDays(d, 1), 0);
const dateOf = (ts: number) => toISODate(new Date(ts));
const doneBy = (t: Task, limit: number) => t.done && t.doneAt !== undefined && t.doneAt < limit;

/** Racha más larga de días consecutivos (en el orden dado) que cumplen `ok`. `null` no suma ni corta. */
function longestRun(items: (boolean | null)[]): number {
  let best = 0;
  let run = 0;
  for (const ok of items) {
    if (ok === null) continue;
    run = ok ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Fechas desde `from` hasta `to` inclusive. */
function daysBetween(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to && out.length < 1500; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Valor actual de cada logro (lo que se compara con las metas de sus niveles). */
export function measure(data: AchievementInput, now = Date.now()): Record<string, number> {
  const today = todayISO(new Date(now));
  const blocks = new Map(data.weekly.map((b) => [b.id, b]));

  // —— Clases ——
  const marks = Object.entries(data.attendance ?? {})
    .flatMap(([date, day]) =>
      Object.entries(day).map(([blockId, mark]) => ({ date, mark, block: blocks.get(blockId) })),
    )
    // Un "no voy" marcado antes de la clase cuenta recién cuando la clase termina.
    .filter((m) => !m.block || tsAt(m.date, hhmmToMin(m.block.end)) <= now)
    .sort((a, b) =>
      a.date === b.date ? hhmmToMin(a.block?.start ?? '00:00') - hhmmToMin(b.block?.start ?? '00:00') : a.date < b.date ? -1 : 1,
    );
  const fui = marks.filter((m) => m.mark === 'fui');

  let perfectWeeks = 0;
  const markedWeeks = new Set(marks.map((m) => startOfWeek(m.date)));
  for (const week of markedWeeks) {
    const byCourse = new Map<string, boolean>();
    for (const day of daysBetween(week, addDays(week, 6))) {
      const skip = new Set(data.skipped[day] ?? []);
      const wd = weekdayOf(day);
      for (const b of data.weekly) {
        if (b.kind !== 'clase' || !b.courseId || b.weekday !== wd || skip.has(b.id)) continue;
        if (tsAt(day, hhmmToMin(b.end)) > now) continue;
        const went = data.attendance?.[day]?.[b.id] === 'fui';
        byCourse.set(b.courseId, (byCourse.get(b.courseId) ?? true) && went);
      }
    }
    perfectWeeks += [...byCourse.values()].filter(Boolean).length;
  }

  // —— Foco ——
  const timed = data.entries.filter((e) => !e.manual);
  const focusMin = data.entries.reduce((s, e) => s + (e.end - e.start) / 60000, 0);
  const focusByDay = new Map<ISODate, number>();
  for (const e of data.entries) {
    const d = dateOf(e.start);
    focusByDay.set(d, (focusByDay.get(d) ?? 0) + (e.end - e.start) / 60000);
  }
  const tasksByDay = new Map<ISODate, Task[]>();
  for (const t of data.tasks) tasksByDay.set(t.date, [...(tasksByDay.get(t.date) ?? []), t]);
  let productiveDays = 0;
  for (const [day, list] of tasksByDay) {
    if (day > today) continue;
    const planned = list.reduce((s, t) => s + t.estimateMin, 0);
    if (planned >= 30 && (focusByDay.get(day) ?? 0) >= planned) productiveDays++;
  }

  // —— Tareas ——
  const done = data.tasks.filter((t) => t.done);
  const onTime = done.filter((t) => t.deadline && doneBy(t, endOfDay(t.deadline)));
  let cleanDays = 0;
  for (const [day, list] of tasksByDay) {
    if (list.length >= 2 && list.every((t) => doneBy(t, endOfDay(day)))) cleanDays++;
  }
  const taskWeeks = new Set(data.tasks.map((t) => startOfWeek(t.date)));
  const thisWeek = startOfWeek(today);
  let noPostponeWeeks = 0;
  for (const week of taskWeeks) {
    if (week >= thisWeek) continue;
    const list = data.tasks.filter((t) => t.date >= week && t.date <= addDays(week, 6));
    if (list.length >= 5 && list.every((t) => doneBy(t, endOfDay(t.date)))) noPostponeWeeks++;
  }

  // —— Rachas ——
  const firstDay = data.tasks.reduce<ISODate | null>((min, t) => (!min || t.date < min ? t.date : min), null);
  const streakDays = firstDay
    ? daysBetween(firstDay, today).map((d) => {
        const list = tasksByDay.get(d);
        if (!list?.length) return null;
        const ok = list.every((t) => t.done);
        // Hoy todavía no termina: si falta algo, no corta la racha.
        return ok ? true : d === today ? null : false;
      })
    : [];
  const activeDays = new Set<ISODate>([
    ...data.entries.map((e) => dateOf(e.start)),
    ...done.flatMap((t) => (t.doneAt ? [dateOf(t.doneAt)] : [])),
  ]);
  const weekends = new Set([...activeDays].map((d) => startOfWeek(d)));
  const activeWeekends = [...weekends].filter((w) => activeDays.has(addDays(w, 5)) && activeDays.has(addDays(w, 6))).length;

  // —— Ramos ——
  let fullCourseWeeks = 0;
  for (const week of taskWeeks) {
    const end = tsAt(addDays(week, 7), 0);
    const byCourse = new Map<string, Task[]>();
    for (const t of data.tasks) {
      if (t.personal || !t.courseId || t.date < week || t.date > addDays(week, 6)) continue;
      byCourse.set(t.courseId, [...(byCourse.get(t.courseId) ?? []), t]);
    }
    for (const list of byCourse.values()) if (list.length >= 2 && list.every((t) => doneBy(t, end))) fullCourseWeeks++;
  }
  let prepared = 0;
  for (const ev of data.events) {
    if (ev.kind !== 'evaluacion' || !ev.courseId || ev.date > today) continue;
    const study = data.tasks.filter(
      (t) => t.courseId === ev.courseId && !t.personal && t.activityId === 'estudio' && t.date >= addDays(ev.date, -7) && t.date <= ev.date,
    );
    const limit = ev.start ? tsAt(ev.date, hhmmToMin(ev.start)) : endOfDay(ev.date);
    if (study.length > 0 && study.every((t) => doneBy(t, limit))) prepared++;
  }
  let balancedWeeks = 0;
  if (data.courses.length >= 2) {
    const courseWeeks = new Map<ISODate, Set<string>>();
    for (const e of data.entries) {
      if (e.personal || !e.courseId) continue;
      const w = startOfWeek(dateOf(e.start));
      courseWeeks.set(w, (courseWeeks.get(w) ?? new Set()).add(e.courseId));
    }
    for (const set of courseWeeks.values()) if (data.courses.every((c) => set.has(c.id))) balancedWeeks++;
  }

  // —— Hábitos ——
  const surveys = [...new Set(data.surveyWeeks ?? [])].sort();
  let surveyRun = 0;
  for (let i = 0, run = 0; i < surveys.length; i++) {
    run = i > 0 && surveys[i - 1] === addDays(surveys[i], -7) ? run + 1 : 1;
    surveyRun = Math.max(surveyRun, run);
  }

  return {
    presente: fui.length,
    'semana-perfecta': perfectWeeks,
    'racha-asistencia': longestRun(marks.map((m) => m.mark === 'fui')),
    madrugadora: fui.filter((m) => m.block && hhmmToMin(m.block.start) <= 8 * 60 + 30).length,
    'primer-sprint': timed.length,
    'zona-foco': Math.floor(timed.reduce((max, e) => Math.max(max, (e.end - e.start) / 60000), 0)),
    horas: Math.floor(focusMin / 60),
    'dia-productivo': productiveDays,
    check: done.length,
    'a-tiempo': onTime.length,
    'dia-limpio': cleanDays,
    'sin-dejar': noPostponeWeeks,
    'paso-a-paso': onTime.filter((t) => t.subtasks.length >= 2).length,
    constante: longestRun(streakDays),
    'finde-activo': activeWeekends,
    'ramo-100': fullCourseWeeks,
    preparada: prepared,
    equilibrio: balancedWeeks,
    encuestada: surveyRun,
    viaje: done.filter((t) => t.onTheGo).length,
    'primer-gustito': data.stars.filter(isRedemption).length,
    ahorradora: balanceOf(data.stars),
  };
}

export interface AchievementStatus extends AchievementDef {
  value: number;
  /** Niveles ganados (los ya dados nunca se pierden, aunque el valor baje). */
  level: number;
  /** Meta del siguiente nivel, o null si ya está completo. */
  next: Tier | null;
}

export function statusOf(data: AchievementInput, awarded: Record<string, number>, now = Date.now()): AchievementStatus[] {
  const values = measure(data, now);
  return ACHIEVEMENTS.map((def) => {
    const value = values[def.id] ?? 0;
    const reached = def.tiers.filter((t) => value >= t.goal).length;
    const level = Math.max(reached, awarded[def.id] ?? 0);
    return { ...def, value, level, next: def.tiers[level] ?? null };
  });
}

export interface Unlock {
  id: string;
  title: string;
  level: number;
  stars: number;
}

/** Niveles recién alcanzados que todavía no se han dado. */
export function pendingUnlocks(statuses: AchievementStatus[], awarded: Record<string, number>): Unlock[] {
  return statuses.flatMap((s) => {
    const given = awarded[s.id] ?? 0;
    return s.tiers.slice(given, s.level).map((tier, i) => ({ id: s.id, title: s.title, level: given + i + 1, stars: tier.stars }));
  });
}
