import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { StarBadge } from '../../components/StarBadge';
import { useStreak } from '../../hooks/useDerived';
import { useNow } from '../../hooks/useNow';
import { useSubtaskDays } from '../../hooks/useSubtaskDays';
import { doneBlocksFor, doneDayOf } from '../../lib/doneBlocks';
import { buildUnits, busyBlocksFor, planDay, travelBlocksFor } from '../../lib/scheduler';
import { minutesOn, taskDays } from '../../lib/spread';
import { focusPhrase } from '../../lib/voice';
import { WEEKDAYS, addDays, formatDuration, formatLongDate, formatShortDate, minutesOfDay, toISODate, today, tsAt, weekdayOf } from '../../lib/time';
import { MonthPicker } from '../../components/MonthPicker';
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
  const [picking, setPicking] = useState(false);

  const tasks = useStore((s) => s.tasks);
  const entries = useStore((s) => s.entries);
  const weekly = useStore((s) => s.weekly);
  const events = useStore((s) => s.events);
  const skipped = useStore((s) => s.skipped);
  const attendance = useStore((s) => s.attendance);
  const settings = useStore((s) => s.settings);
  const travelOverrides = useStore((s) => s.travel[date]);
  const pins = useStore((s) => s.pins[date]);
  const activeTimer = useStore((s) => s.activeTimer);
  const openTaskForm = useUI((s) => s.openTaskForm);
  const { streak, multiplier } = useStreak();

  const isToday = date === todayDate;
  const isPast = date < todayDate;

  // Día que le toca a cada subtarea de las tareas que se reparten entre varios días.
  const subDays = useSubtaskDays(now);

  // Hoy incluye lo atrasado; otros días muestran solo lo planificado para ese día. Una tarea
  // repartida aparece en cada día en que tiene subtareas. Las terminadas aparecen el día en
  // que las marcaste como hechas (una atrasada que terminas hoy se ve hoy).
  const dayTasks = useMemo(
    () =>
      tasks.filter((t) =>
        t.done ? doneDayOf(t) === date : isPast ? t.date === date : taskDays(t, subDays, todayDate).includes(date),
      ),
    [tasks, date, isPast, subDays, todayDate],
  );

  const plan = useMemo(() => {
    const fromMin = isToday ? Math.ceil(minutesOfDay(now) / 5) * 5 : 0;
    // Un día que ya terminó no agenda nada: lo que quedó sin hacer pasa al día siguiente
    // (y así sigue hasta hoy), en vez de ocupar horas en que no se trabajó.
    const units = isPast ? [] : buildUnits(dayTasks, entries, date, { days: subDays, today: todayDate });
    const travel = travelBlocksFor(date, weekly, skipped, travelOverrides, settings, attendance);
    return planDay(units, busyBlocksFor(date, weekly, events, skipped, attendance), settings, fromMin, { travel, pins });
  }, [dayTasks, entries, date, weekly, events, skipped, attendance, settings, isToday, isPast, now, travelOverrides, pins, subDays, todayDate]);

  // Días con tareas o tiempo registrado, para marcarlos en el calendario de "Ir a un día".
  const markedDays = useMemo(() => {
    if (!picking) return undefined;
    const set = new Set<string>();
    for (const t of tasks) set.add(t.done ? doneDayOf(t) : t.date);
    for (const e of entries) set.add(toISODate(new Date(e.start)));
    return set;
  }, [picking, tasks, entries]);

  const rolledOver = isPast ? dayTasks.filter((t) => !t.done).length : 0;

  // Lo hecho se queda en las horas en que se trabajó (aunque la tarea fuera de otro día).
  const doneBlocks = useMemo(() => doneBlocksFor(date, tasks, entries), [date, tasks, entries]);
  const doneWithoutTime = useMemo(() => {
    const shown = new Set(doneBlocks.map((b) => b.taskId));
    return dayTasks.filter((t) => t.done && !shown.has(t.id));
  }, [dayTasks, doneBlocks]);

  const dayStart = tsAt(date, 0);
  const dayEnd = tsAt(addDays(date, 1), 0);
  const focusedMin =
    entries
      .filter((e) => e.end > dayStart && e.start < dayEnd)
      .reduce((s, e) => s + (Math.min(e.end, dayEnd) - Math.max(e.start, dayStart)) / 60000, 0) +
    (isToday && activeTimer ? (now - activeTimer.startedAt) / 60000 : 0);
  const plannedMin = dayTasks.reduce((s, t) => s + minutesOn(t, date, subDays, todayDate), 0);
  const pct = plannedMin > 0 ? Math.min(100, (focusedMin / plannedMin) * 100) : 0;

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">{formatLongDate(date)}</span>
          <h1 className="title">{isToday ? 'Hoy' : isPast ? 'Día pasado' : 'Planificación'}</h1>
        </div>
        <StarBadge />
      </header>

      <div className={styles.dayNav}>
        <button type="button" className="icon-btn" aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))}>
          <Icon name="back" />
        </button>
        <button type="button" className={`btn btn--sm ${styles.datePick}`} aria-label="Ir a un día" onClick={() => setPicking(true)}>
          <Icon name="calendar" size={18} />
          {isToday ? `Hoy · ${shortDay(date)}` : shortDay(date)}
          <Icon name="down" size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label="Día siguiente" onClick={() => setDate(addDays(date, 1))}>
          <Icon name="next" />
        </button>
      </div>

      <div className="card stack">
        <div className="row row--between small" style={{ fontWeight: 700, flexWrap: 'wrap', rowGap: 2 }}>
          <span>
            {focusPhrase(formatDuration(focusedMin), formatDuration(plannedMin), settings.voice)}
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
        <>
          <DayTimeline date={date} plan={plan} doneBlocks={doneBlocks} doneTasks={doneWithoutTime} />
          {rolledOver > 0 && (
            <p className="small muted" style={{ textAlign: 'center' }}>
              {rolledOver === 1 ? '1 tarea sin terminar pasó' : `${rolledOver} tareas sin terminar pasaron`} al día siguiente.
            </p>
          )}
        </>
      ) : (
        <TaskList tasks={dayTasks} date={date} days={subDays} todayDate={todayDate} />
      )}

      {picking && (
        <MonthPicker
          title="Ir a un día"
          value={date}
          todayDate={todayDate}
          marked={markedDays}
          onClose={() => setPicking(false)}
          onPick={(d) => {
            setDate(d);
            setPicking(false);
          }}
        />
      )}

      <button type="button" className={styles.fab} aria-label="Nueva tarea" onClick={() => openTaskForm({ date })}>
        <Icon name="plus" size={28} strokeWidth={2.6} />
      </button>
    </div>
  );
}

/** "sáb 14 nov". */
function shortDay(d: string): string {
  return `${WEEKDAYS[weekdayOf(d)].slice(0, 3).toLowerCase()} ${formatShortDate(d)}`;
}
