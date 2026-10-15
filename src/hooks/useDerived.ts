import { useMemo } from 'react';
import { balanceOf, computeStreak, multiplierFor } from '../lib/rewards';
import { today } from '../lib/time';
import { useStore } from '../store/useStore';

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
  const activityTypes = useStore((s) => s.activityTypes);
  return useMemo(
    () => ({
      course: (id?: string) => courses.find((c) => c.id === id),
      activityName: (id: string) => activityTypes.find((a) => a.id === id)?.name ?? 'Otro',
    }),
    [courses, activityTypes],
  );
}
