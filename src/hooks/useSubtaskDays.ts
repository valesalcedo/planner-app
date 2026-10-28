import { useMemo } from 'react';
import { spreadSubtasks, type SubtaskDays } from '../lib/spread';
import { minutesOfDay, today } from '../lib/time';
import { useStore } from '../store/useStore';
import type { Task } from '../types';

/**
 * Día que le toca a cada subtarea de las tareas repartidas entre varios días.
 * Se recalcula desde hoy, así lo que no alcanzaste a hacer se vuelve a repartir solo.
 * `draft` reemplaza (o agrega) una tarea, para mostrar el reparto mientras la editas.
 */
export function useSubtaskDays(now: number, draft?: Task): SubtaskDays {
  const tasks = useStore((s) => s.tasks);
  const entries = useStore((s) => s.entries);
  const weekly = useStore((s) => s.weekly);
  const events = useStore((s) => s.events);
  const skipped = useStore((s) => s.skipped);
  const attendance = useStore((s) => s.attendance);
  const travel = useStore((s) => s.travel);
  const settings = useStore((s) => s.settings);
  const todayDate = today(new Date(now));
  // Cada 15 minutos basta: el reparto depende de cuánto tiempo libre queda hoy.
  const nowMin = Math.floor(minutesOfDay(now) / 15) * 15;
  return useMemo(() => {
    const list = draft ? [...tasks.filter((t) => t.id !== draft.id), draft] : tasks;
    return spreadSubtasks(list, { today: todayDate, nowMin, entries, weekly, events, skipped, attendance, travel, settings });
  }, [tasks, draft, todayDate, nowMin, entries, weekly, events, skipped, attendance, travel, settings]);
}
