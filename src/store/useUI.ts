import { create } from 'zustand';
import type { ISODate } from '../types';

export type Tab = 'hoy' | 'calendario' | 'foco' | 'stats' | 'tienda';
export type Page = 'ajustes' | 'horario' | 'papelera' | null;

interface TaskFormState {
  taskId?: string;
  date?: ISODate;
}

interface TimeLogState {
  taskId?: string;
}

export interface ToastAction {
  label: string;
  run: () => void;
}

interface UIState {
  tab: Tab;
  page: Page;
  taskForm: TaskFormState | null;
  /** Hoja para agregar tiempo a mano. */
  timeLog: TimeLogState | null;
  toast: string | null;
  /** Botón opcional del aviso (por ejemplo, "Deshacer"). */
  toastAction: ToastAction | null;
  setTab: (tab: Tab) => void;
  openPage: (page: Page) => void;
  openTaskForm: (state?: TaskFormState) => void;
  closeTaskForm: () => void;
  openTimeLog: (state?: TimeLogState) => void;
  closeTimeLog: () => void;
  showToast: (msg: string, action?: ToastAction) => void;
  hideToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Estado de navegación (no se guarda entre sesiones). */
export const useUI = create<UIState>()((set) => ({
  tab: 'hoy',
  page: null,
  taskForm: null,
  timeLog: null,
  toast: null,
  toastAction: null,
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
  openTimeLog: (state = {}) => set({ timeLog: state }),
  closeTimeLog: () => set({ timeLog: null }),
  showToast: (msg, action) => {
    clearTimeout(toastTimer);
    set({ toast: msg, toastAction: action ?? null });
    // Con un botón se queda más rato, para alcanzar a tocarlo.
    toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), action ? 6000 : 2600);
  },
  hideToast: () => {
    clearTimeout(toastTimer);
    set({ toast: null, toastAction: null });
  },
}));
