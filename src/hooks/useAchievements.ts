import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { pendingUnlocks, statusOf, titleFor, type AchievementStatus } from '../lib/achievements';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';

/** Estado de todos los logros (avance y niveles ganados). */
export function useAchievementStatus(): AchievementStatus[] {
  const data = useStore(
    useShallow((s) => ({
      tasks: s.tasks,
      entries: s.entries,
      weekly: s.weekly,
      skipped: s.skipped,
      attendance: s.attendance,
      events: s.events,
      courses: s.courses,
      stars: s.stars,
      surveyWeeks: s.surveyWeeks,
    })),
  );
  const awarded = useStore((s) => s.achievements);
  const voice = useStore((s) => s.settings.voice);
  return useMemo(
    () => statusOf(data, awarded).map((a) => ({ ...a, title: titleFor(a, voice) })),
    [data, awarded, voice],
  );
}

/** Revisa los logros cada vez que cambian tus datos y da los nuevos, con un aviso. */
export function useAchievementWatcher(): void {
  const statuses = useAchievementStatus();
  const awarded = useStore((s) => s.achievements);
  const unlock = useStore((s) => s.unlockAchievements);
  const showToast = useUI((s) => s.showToast);
  const setTab = useUI((s) => s.setTab);

  useEffect(() => {
    const fresh = pendingUnlocks(statuses, awarded);
    if (fresh.length === 0) return;
    unlock(fresh);
    const stars = fresh.reduce((s, u) => s + u.stars, 0);
    const msg =
      fresh.length === 1
        ? `¡Logro: ${fresh[0].title}!${stars > 0 ? ` +${stars} estrellas` : ''}`
        : `¡Ganaste ${fresh.length} logros!${stars > 0 ? ` +${stars} estrellas` : ''}`;
    showToast(msg, { label: 'Ver', run: () => setTab('logros') });
  }, [statuses, awarded, unlock, showToast, setTab]);
}
