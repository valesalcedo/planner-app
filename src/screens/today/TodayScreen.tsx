import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { StarBadge } from '../../components/StarBadge';
import { useStreak } from '../../hooks/useDerived';
import { useNow } from '../../hooks/useNow';
import { buildUnits, busyBlocksFor, planDay } from '../../lib/scheduler';
import { addDays, formatDuration, formatLongDate, minutesOfDay, today, tsAt } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import { DayTimeline } from './DayTimeline';
import { TaskList } from './TaskList';
import styles from './Today.module.css';

type View = 'dia' | 'lista';

export function TodayScreen() {
  const now = useNow(30_000);
  const todayDate = today(new Date(now));
  const [date, setDate] = useState(todayDate);
  const [view, setView] = useState<View>('dia');

  const tasks = useStore((s) => s.tasks);
  const entries = useStore((s) => s.entries);
  const weekly = useStore((s) => s.weekly);
  const events = useStore((s) => s.events);
  const skipped = useStore((s) => s.skipped);
  const settings = useStore((s) => s.settings);
  const activeTimer = useStore((s) => s.activeTimer);
  const openTaskForm = useUI((s) => s.openTaskForm);
  const openPage = useUI((s) => s.openPage);
  const { streak, multiplier } = useStreak();

  const isToday = date === todayDate;
  const isPast = date < todayDate;

  // Hoy incluye lo atrasado; otros días muestran solo lo planificado para ese día.
  const dayTasks = useMemo(
    () => tasks.filter((t) => (isToday ? t.date === date || (t.date < date && !t.done) : t.date === date)),
    [tasks, date, isToday],
  );

  const plan = useMemo(() => {
    const fromMin = isToday ? Math.ceil(minutesOfDay(now) / 5) * 5 : 0;
    const units = buildUnits(isToday ? dayTasks : dayTasks.filter((t) => t.date === date), entries, date);
    return planDay(units, busyBlocksFor(date, weekly, events, skipped), settings, fromMin);
  }, [dayTasks, entries, date, weekly, events, skipped, settings, isToday, now]);

  const dayStart = tsAt(date, 0);
  const dayEnd = tsAt(addDays(date, 1), 0);
  const focusedMin =
    entries
      .filter((e) => e.end > dayStart && e.start < dayEnd)
      .reduce((s, e) => s + (Math.min(e.end, dayEnd) - Math.max(e.start, dayStart)) / 60000, 0) +
    (isToday && activeTimer ? (now - activeTimer.startedAt) / 60000 : 0);
  const plannedMin = dayTasks.reduce((s, t) => s + t.estimateMin, 0);
  const pct = plannedMin > 0 ? Math.min(100, (focusedMin / plannedMin) * 100) : 0;

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">{formatLongDate(date)}</span>
          <h1 className="title">{isToday ? 'Hoy' : isPast ? 'Día pasado' : 'Planificación'}</h1>
        </div>
        <div className="row">
          <button type="button" className="icon-btn" aria-label="Ajustes" onClick={() => openPage('ajustes')}>
            <Icon name="gear" />
          </button>
          <StarBadge />
        </div>
      </header>

      <div className={styles.dayNav}>
        <button type="button" className="icon-btn" aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="back" />
        </button>
        {!isToday ? (
          <button type="button" className="btn btn--sm" onClick={() => setDate(todayDate)}>
            Volver a hoy
          </button>
        ) : (
          <span className="small muted">{dayTasks.filter((t) => !t.done).length} tareas pendientes</span>
        )}
        <button type="button" className="icon-btn" aria-label="Día siguiente" onClick={() => setDate(addDays(date, 1))}>
          <Icon name="next" />
        </button>
      </div>

      <div className="card stack">
        <div className="row row--between small" style={{ fontWeight: 700, flexWrap: 'wrap', rowGap: 2 }}>
          <span>
            {formatDuration(focusedMin)} enfocada de {formatDuration(plannedMin)} planificadas
          </span>
          {streak > 0 && (
            <span className="row" style={{ gap: 4, color: 'var(--primary-deep)', whiteSpace: 'nowrap' }}>
              <Icon name="flame" size={16} />
              Racha {streak} {streak === 1 ? 'día' : 'días'}
              {multiplier > 1 && ` ×${multiplier}`}
            </span>
          )}
        </div>
        <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del día">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="segmented" role="group" aria-label="Vista">
        <button type="button" aria-pressed={view === 'dia'} onClick={() => setView('dia')}>
          Mi día
        </button>
        <button type="button" aria-pressed={view === 'lista'} onClick={() => setView('lista')}>
          Lista de tareas
        </button>
      </div>

      {view === 'dia' ? (
        <DayTimeline date={date} plan={plan} doneTasks={dayTasks.filter((t) => t.done)} />
      ) : (
        <TaskList tasks={dayTasks} date={date} />
      )}

      <button type="button" className={styles.fab} aria-label="Nueva tarea" onClick={() => openTaskForm({ date })}>
        <Icon name="plus" size={28} strokeWidth={2.6} />
      </button>
    </div>
  );
}
