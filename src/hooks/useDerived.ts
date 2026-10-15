import { useMemo } from 'react';
import { balanceOf, computeStreak, multiplierFor } from '../lib/rewards';
import { today } from '../lib/time';
import { useStore } from '../store/useStore';
import type { CalendarEvent, WeeklyBlock } from '../types';

export function useBalance(): number {
  const stars = useStore((s) => s.stars);
  return useMemo(() => balanceOf(stars), [stars]);
}

export function useStreak(): { streak: number; multiplier: number } {
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  return useMemo(() => {
    const streak = computeStreak(tasks, today());
    return { streak, multiplier: multiplierFor(streak, settings) };
  }, [tasks, settings]);
}

export function useLookups() {
  const courses = useStore((s) => s.courses);
  const categories = useStore((s) => s.categories);
  const activityTypes = useStore((s) => s.activityTypes);
  return useMemo(() => {
    const course = (id?: string) => courses.find((c) => c.id === id);
    const category = (id?: string) => categories.find((c) => c.id === id);
    return {
      course,
      category,
      activityName: (id: string) => activityTypes.find((a) => a.id === id)?.name ?? 'Otro',
      /** Color de un bloque del horario: el del ramo si es clase, el de la categoría si es otra actividad. */
      blockColor: (b: Pick<WeeklyBlock, 'kind' | 'courseId' | 'categoryId'>) =>
        b.kind === 'clase' ? course(b.courseId)?.color : category(b.categoryId)?.color,
      /** Color de un evento: su ramo o su categoría. */
      eventColor: (e: Pick<CalendarEvent, 'courseId' | 'categoryId'>) => course(e.courseId)?.color ?? category(e.categoryId)?.color,
    };
  }, [courses, categories, activityTypes]);
}
