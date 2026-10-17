import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AppData,
  Attendance,
  CalendarEvent,
  Category,
  Course,
  ISODate,
  ManualEntryInput,
  Reward,
  Settings,
  StarKind,
  Task,
  TimeEntry,
  WeeklyBlock,
} from '../types';
import { uid } from '../lib/id';
import { balanceOf, bonusFor, classRef, computeStreak, multiplierFor, starsForFocus } from '../lib/rewards';
import { hhmmToMin, today, tsAt } from '../lib/time';
import { initialData } from './defaults';

type Draft<T extends { id: string }> = Omit<T, 'id'>;

/** Registro de tiempo con los datos de la tarea copiados, para que las estadísticas no cambien después. */
function entryFor(task: Task, subtaskId: string | undefined, start: number, end: number, manual?: boolean): TimeEntry {
  return {
    id: uid(),
    taskId: task.id,
    subtaskId,
    courseId: task.personal ? undefined : task.courseId,
    activityId: task.activityId,
    personal: task.personal || undefined,
    categoryId: task.personal ? task.categoryId : undefined,
    start,
    end,
    manual: manual || undefined,
  };
}

function pickData(s: AppData): AppData {
  return {
    version: 1,
    courses: s.courses,
    categories: s.categories,
    activityTypes: s.activityTypes,
    tasks: s.tasks,
    entries: s.entries,
    activeTimer: s.activeTimer,
    weekly: s.weekly,
    skipped: s.skipped,
    attendance: s.attendance,
    events: s.events,
    rewards: s.rewards,
    stars: s.stars,
    settings: s.settings,
  };
}

interface Actions {
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'done'>) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setTaskDone: (id: string, done: boolean) => void;
  setSubtaskDone: (taskId: string, subtaskId: string, done: boolean) => void;
  moveTask: (id: string, date: ISODate) => void;

  startTimer: (taskId: string, subtaskId?: string) => void;
  /** Detiene el cronómetro, guarda el registro y suma estrellas. Devuelve las estrellas ganadas. */
  stopTimer: () => number;
  /**
   * Registra tiempo a mano (por si se te olvidó el cronómetro) y suma estrellas.
   * Devuelve las estrellas ganadas, o null si las horas no son válidas.
   */
  addManualEntry: (input: ManualEntryInput) => number | null;
  /** Borra un registro de tiempo y las estrellas que dio. */
  deleteEntry: (id: string) => void;

  saveBlock: (b: WeeklyBlock | Draft<WeeklyBlock>) => void;
  deleteBlock: (id: string) => void;
  toggleSkip: (date: ISODate, blockId: string) => void;
  /** Marca si fuiste a una clase ese día (null para dejarla sin marcar). Suma o quita estrellas. */
  setAttendance: (date: ISODate, blockId: string, value: Attendance | null) => void;

  saveEvent: (e: CalendarEvent | Draft<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  saveCourse: (c: Course | Draft<Course>) => void;
  deleteCourse: (id: string) => void;
  saveActivityType: (name: string, id?: string) => void;
  /** Crea o edita una categoría. Devuelve su id. */
  saveCategory: (c: Category | Draft<Category>) => string;
  deleteCategory: (id: string) => void;

  saveReward: (r: Reward | Draft<Reward>) => void;
  deleteReward: (id: string) => void;
  redeem: (rewardId: string) => boolean;
  /** Quita un movimiento del historial de estrellas (para corregir errores). */
  deleteStarTx: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  importData: (data: AppData) => void;
  resetData: () => void;
}

export type Store = AppData & Actions;

function upsert<T extends { id: string }>(list: T[], item: T | Draft<T>): T[] {
  if ('id' in item && item.id) {
    const exists = list.some((x) => x.id === item.id);
    return exists ? list.map((x) => (x.id === item.id ? (item as T) : x)) : [...list, item as T];
  }
  return [...list, { ...(item as Draft<T>), id: uid() } as T];
}

/** Completa con valores por defecto lo que falte (respaldos o datos de versiones anteriores). */
function withDefaults(data: Partial<AppData>): AppData {
  const base = initialData();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...data.settings, bonus: { ...base.settings.bonus, ...data.settings?.bonus } },
  };
}

export const useStore = create<Store>()(
  persist<Store, [], [], AppData>(
    (set, get) => {
      const currentMultiplier = () =>
        multiplierFor(computeStreak(get().tasks, today()), get().settings);

      const award = (amount: number, reason: string, kind: StarKind, ref?: string) => {
        if (amount === 0) return;
        set((s) => ({ stars: [...s.stars, { id: uid(), amount, reason, at: Date.now(), kind, ref }] }));
      };

      /** Borra los movimientos de un tipo ligados a una tarea o clase, como si nunca se hubieran dado. */
      const revoke = (kind: StarKind, ref: string) =>
        set((s) => ({ stars: s.stars.filter((t) => !(t.kind === kind && t.ref === ref)) }));

      return {
        ...initialData(),

        addTask: (t) =>
          set((s) => ({ tasks: [...s.tasks, { ...t, id: uid(), createdAt: Date.now(), done: false }] })),

        updateTask: (id, patch) =>
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

        deleteTask: (id) => {
          // El bono por terminarla se quita (la tarea ya no existe). El tiempo cronometrado y
          // sus estrellas se mantienen, porque ese trabajo sí lo hiciste.
          revoke('tarea', id);
          set((s) => ({
            tasks: s.tasks.filter((t) => t.id !== id),
            activeTimer: s.activeTimer?.taskId === id ? null : s.activeTimer,
          }));
        },

        setTaskDone: (id, done) => {
          const task = get().tasks.find((t) => t.id === id);
          if (!task || task.done === done) return;
          if (get().activeTimer?.taskId === id) get().stopTimer();
          const mult = currentMultiplier();
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    done,
                    doneAt: done ? Date.now() : undefined,
                    subtasks: done ? t.subtasks.map((st) => ({ ...st, done: true })) : t.subtasks,
                  }
                : t,
            ),
          }));
          // Siempre se deshace exactamente lo que se dio, sin importar cómo cambió la racha.
          revoke('tarea', id);
          if (done) award(bonusFor(task.difficulty, get().settings, mult), `Terminaste "${task.title}"`, 'tarea', id);
        },

        setSubtaskDone: (taskId, subtaskId, done) => {
          const task = get().tasks.find((t) => t.id === taskId);
          if (!task) return;
          const timer = get().activeTimer;
          if (timer?.taskId === taskId && timer.subtaskId === subtaskId) get().stopTimer();
          const subtasks = task.subtasks.map((st) => (st.id === subtaskId ? { ...st, done } : st));
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, subtasks } : t)) }));
          if (subtasks.length > 0 && subtasks.every((st) => st.done) && !task.done) get().setTaskDone(taskId, true);
          if (!done && task.done) get().setTaskDone(taskId, false);
        },

        moveTask: (id, date) => get().updateTask(id, { date }),

        startTimer: (taskId, subtaskId) => {
          if (get().activeTimer) get().stopTimer();
          set({ activeTimer: { taskId, subtaskId, startedAt: Date.now() } });
        },

        stopTimer: () => {
          const timer = get().activeTimer;
          if (!timer) return 0;
          const end = Date.now();
          const task = get().tasks.find((t) => t.id === timer.taskId);
          set({ activeTimer: null });
          if (!task || end - timer.startedAt < 30_000) return 0;
          const entry = entryFor(task, timer.subtaskId, timer.startedAt, end);
          set((s) => ({ entries: [...s.entries, entry] }));
          const earned = starsForFocus((end - timer.startedAt) / 60000, get().settings, currentMultiplier());
          award(earned, `Foco en "${task.title}"`, 'foco', entry.id);
          return earned;
        },

        addManualEntry: ({ taskId, subtaskId, date, start, end }) => {
          const task = get().tasks.find((t) => t.id === taskId);
          const from = hhmmToMin(start);
          const to = hhmmToMin(end);
          if (!task || !(to > from)) return null;
          const startTs = tsAt(date, from);
          const endTs = tsAt(date, to);
          if (startTs > Date.now()) return null;
          const entry = entryFor(task, subtaskId, startTs, endTs, true);
          set((s) => ({ entries: [...s.entries, entry] }));
          const earned = starsForFocus(to - from, get().settings, currentMultiplier());
          award(earned, `Tiempo agregado a "${task.title}"`, 'foco', entry.id);
          return earned;
        },

        deleteEntry: (id) => {
          // Los registros nuevos guardan sus estrellas con el id del registro; los antiguos no se pueden separar.
          revoke('foco', id);
          set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
        },

        saveBlock: (b) => set((s) => ({ weekly: upsert(s.weekly, b) })),
        deleteBlock: (id) => set((s) => ({ weekly: s.weekly.filter((b) => b.id !== id) })),
        toggleSkip: (date, blockId) =>
          set((s) => {
            const list = s.skipped[date] ?? [];
            const skipping = !list.includes(blockId);
            const next = skipping ? [...list, blockId] : list.filter((x) => x !== blockId);
            if (skipping && s.attendance[date]?.[blockId]) {
              // Si no hubo clase, no hay asistencia que marcar.
              const day = { ...s.attendance[date] };
              delete day[blockId];
              const ref = classRef(date, blockId);
              return {
                skipped: { ...s.skipped, [date]: next },
                attendance: { ...s.attendance, [date]: day },
                stars: s.stars.filter((t) => !(t.kind === 'clase' && t.ref === ref)),
              };
            }
            return { skipped: { ...s.skipped, [date]: next } };
          }),
        setAttendance: (date, blockId, value) => {
          const block = get().weekly.find((b) => b.id === blockId);
          if (!block) return;
          const ref = classRef(date, blockId);
          revoke('clase', ref);
          set((s) => {
            const day = { ...(s.attendance[date] ?? {}) };
            if (value) day[blockId] = value;
            else delete day[blockId];
            // Si fuiste o faltaste, la clase sí ocurrió.
            const skippedDay = (s.skipped[date] ?? []).filter((x) => x !== blockId);
            return { attendance: { ...s.attendance, [date]: day }, skipped: { ...s.skipped, [date]: skippedDay } };
          });
          if (value === 'fui') award(get().settings.starsPerClass, `Fuiste a "${block.title}"`, 'clase', ref);
        },

        saveEvent: (e) => set((s) => ({ events: upsert(s.events, e) })),
        deleteEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

        saveCourse: (c) => set((s) => ({ courses: upsert(s.courses, c) })),
        deleteCourse: (id) => set((s) => ({ courses: s.courses.filter((c) => c.id !== id) })),
        saveActivityType: (name, id) =>
          set((s) => ({
            activityTypes: id
              ? s.activityTypes.map((a) => (a.id === id ? { ...a, name } : a))
              : [...s.activityTypes, { id: uid(), name }],
          })),

        saveCategory: (c) => {
          const id = 'id' in c && c.id ? c.id : uid();
          set((s) => ({ categories: upsert(s.categories, { ...c, id } as Category) }));
          return id;
        },
        deleteCategory: (id) =>
          set((s) => ({
            categories: s.categories.filter((c) => c.id !== id),
            weekly: s.weekly.map((b) => (b.categoryId === id ? { ...b, categoryId: undefined } : b)),
            events: s.events.map((e) => (e.categoryId === id ? { ...e, categoryId: undefined } : e)),
            tasks: s.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: undefined } : t)),
          })),

        saveReward: (r) => set((s) => ({ rewards: upsert(s.rewards, r) })),
        deleteReward: (id) => set((s) => ({ rewards: s.rewards.filter((r) => r.id !== id) })),
        redeem: (rewardId) => {
          const reward = get().rewards.find((r) => r.id === rewardId);
          if (!reward || balanceOf(get().stars) < reward.price) return false;
          award(-reward.price, `Canjeaste "${reward.name}"`, 'canje');
          return true;
        },
        deleteStarTx: (id) => set((s) => ({ stars: s.stars.filter((t) => t.id !== id) })),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        importData: (data) => set(withDefaults(data)),
        resetData: () => set(initialData()),
      };
    },
    {
      name: 'planner-estrellas-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: pickData,
      // Los datos guardados antes de una actualización pueden no tener campos nuevos.
      merge: (persisted, current) => ({ ...current, ...withDefaults(persisted as Partial<AppData>) }),
    },
  ),
);

/** Solo los datos (sin acciones), para exportar un respaldo. */
export function snapshot(): AppData {
  return pickData(useStore.getState());
}
