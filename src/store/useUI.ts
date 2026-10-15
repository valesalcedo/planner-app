import { create } from 'zustand';
import type { ISODate } from '../types';

export type Tab = 'hoy' | 'calendario' | 'foco' | 'stats' | 'tienda';
export type Page = 'ajustes' | 'horario' | null;

interface TaskFormState {
  taskId?: string;
  date?: ISODate;
}

interface UIState {
  tab: Tab;
  page: Page;
  taskForm: TaskFormState | null;
  toast: string | null;
  setTab: (tab: Tab) => void;
  openPage: (page: Page) => void;
  openTaskForm: (state?: TaskFormState) => void;
  closeTaskForm: () => void;
  showToast: (msg: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Estado de navegación (no se guarda entre sesiones). */
export const useUI = create<UIState>()((set) => ({
  tab: 'hoy',
  page: null,
  taskForm: null,
  toast: null,
  setTab: (tab) => {
    set({ tab, page: null });
    window.scrollTo({ top: 0 });
  },
  openPage: (page) => {
    set({ page });
    window.scrollTo({ top: 0 });
  },
  openTaskForm: (state = {}) => set({ taskForm: state }),
  closeTaskForm: () => set({ taskForm: null }),
  showToast: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));
