import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  AppData,
  CalendarEvent,
  Course,
  ISODate,
  Reward,
  Settings,
  Task,
  WeeklyBlock,
} from '../types';
import { uid } from '../lib/id';
import { balanceOf, bonusFor, computeStreak, multiplierFor, starsForFocus } from '../lib/rewards';
import { today } from '../lib/time';
import { initialData } from './defaults';

type Draft<T extends { id: string }> = Omit<T, 'id'>;

function pickData(s: AppData): AppData {
  return {
    version: 1,
    courses: s.courses,
    activityTypes: s.activityTypes,
    tasks: s.tasks,
    entries: s.entries,
    activeTimer: s.activeTimer,
    weekly: s.weekly,
    skipped: s.skipped,
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

  saveBlock: (b: WeeklyBlock | Draft<WeeklyBlock>) => void;
  deleteBlock: (id: string) => void;
  toggleSkip: (date: ISODate, blockId: string) => void;

  saveEvent: (e: CalendarEvent | Draft<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  saveCourse: (c: Course | Draft<Course>) => void;
  deleteCourse: (id: string) => void;
  saveActivityType: (name: string, id?: string) => void;

  saveReward: (r: Reward | Draft<Reward>) => void;
  deleteReward: (id: string) => void;
  redeem: (rewardId: string) => boolean;

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

export const useStore = create<Store>()(
  persist<Store, [], [], AppData>(
    (set, get) => {
      const currentMultiplier = () =>
        multiplierFor(computeStreak(get().tasks, today()), get().settings);

      const award = (amount: number, reason: string) => {
        if (amount === 0) return;
        set((s) => ({ stars: [...s.stars, { id: uid(), amount, reason, at: Date.now() }] }));
      };

      return {
        ...initialData(),

        addTask: (t) =>
          set((s) => ({ tasks: [...s.tasks, { ...t, id: uid(), createdAt: Date.now(), done: false }] })),

        updateTask: (id, patch) =>
          set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

        deleteTask: (id) =>
          set((s) => ({
            tasks: s.tasks.filter((t) => t.id !== id),
            activeTimer: s.activeTimer?.taskId === id ? null : s.activeTimer,
          })),

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
          const bonus = bonusFor(task.difficulty, get().settings, mult);
          award(done ? bonus : -bonus, done ? `Terminaste "${task.title}"` : `Desmarcaste "${task.title}"`);
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
          set((s) => ({
            entries: [
              ...s.entries,
              {
                id: uid(),
                taskId: task.id,
                subtaskId: timer.subtaskId,
                courseId: task.courseId,
                activityId: task.activityId,
                start: timer.startedAt,
                end,
              },
            ],
          }));
          const earned = starsForFocus((end - timer.startedAt) / 60000, get().settings, currentMultiplier());
          award(earned, `Foco en "${task.title}"`);
          return earned;
        },

        saveBlock: (b) => set((s) => ({ weekly: upsert(s.weekly, b) })),
        deleteBlock: (id) => set((s) => ({ weekly: s.weekly.filter((b) => b.id !== id) })),
        toggleSkip: (date, blockId) =>
          set((s) => {
            const list = s.skipped[date] ?? [];
            const next = list.includes(blockId) ? list.filter((x) => x !== blockId) : [...list, blockId];
            return { skipped: { ...s.skipped, [date]: next } };
          }),

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

        saveReward: (r) => set((s) => ({ rewards: upsert(s.rewards, r) })),
        deleteReward: (id) => set((s) => ({ rewards: s.rewards.filter((r) => r.id !== id) })),
        redeem: (rewardId) => {
          const reward = get().rewards.find((r) => r.id === rewardId);
          if (!reward || balanceOf(get().stars) < reward.price) return false;
          award(-reward.price, `Canjeaste "${reward.name}"`);
          return true;
        },

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        importData: (data) => set({ ...initialData(), ...data }),
        resetData: () => set(initialData()),
      };
    },
    {
      name: 'planner-estrellas-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: pickData,
    },
  ),
);

/** Solo los datos (sin acciones), para exportar un respaldo. */
export function snapshot(): AppData {
  return pickData(useStore.getState());
}
