import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useLookups } from '../../hooks/useDerived';
import { MONTHS, WEEKDAYS_SHORT, addDays, formatLongDate, parseISODate, startOfWeek, toISODate, today } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { CalendarEvent, EventKind } from '../../types';
import { EventForm } from './EventForm';
import styles from './Calendar.module.css';

export const EVENT_LABEL: Record<EventKind, string> = {
  evaluacion: 'Evaluación',
  entrega: 'Entrega',
  evento: 'Evento',
};

export function CalendarScreen() {
  const todayDate = today();
  const [selected, setSelected] = useState(todayDate);
  const [month, setMonth] = useState(() => todayDate.slice(0, 7));
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);

  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const openPage = useUI((s) => s.openPage);
  const openTaskForm = useUI((s) => s.openTaskForm);
  const { course } = useLookups();

  const first = parseISODate(`${month}-01`);
  const gridStart = startOfWeek(`${month}-01`);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const marks = useMemo(() => {
    const m = new Map<string, Set<'evaluacion' | 'otro'>>();
    const add = (d: string, k: 'evaluacion' | 'otro') => m.set(d, (m.get(d) ?? new Set()).add(k));
    events.forEach((e) => add(e.date, e.kind === 'evaluacion' ? 'evaluacion' : 'otro'));
    tasks.forEach((t) => t.deadline && !t.done && add(t.deadline, 'otro'));
    return m;
  }, [events, tasks]);

  const shiftMonth = (delta: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + delta, 1);
    setMonth(toISODate(d).slice(0, 7));
  };

  const dayEvents = events.filter((e) => e.date === selected).sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
  const dayDeadlines = tasks.filter((t) => t.deadline === selected);
  const dayTasks = tasks.filter((t) => t.date === selected && t.deadline !== selected);
  const upcoming = events
    .filter((e) => e.kind === 'evaluacion' && e.date > selected)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="title" style={{ textTransform: 'capitalize' }}>
          {MONTHS[first.getMonth()]} {first.getFullYear() !== new Date().getFullYear() ? first.getFullYear() : ''}
        </h1>
        <div className="row">
          <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => shiftMonth(-1)}>
            <Icon name="back" />
          </button>
          <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => shiftMonth(1)}>
            <Icon name="next" />
          </button>
        </div>
      </header>

      <div className="card card--lg stack" style={{ gap: 6, padding: 12 }}>
        <div className={styles.weekHead} aria-hidden="true">
          {WEEKDAYS_SHORT.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className={styles.grid} role="grid" aria-label="Días del mes">
          {days.map((d) => {
            const inMonth = d.startsWith(month);
            const m = marks.get(d);
            return (
              <button
                key={d}
                type="button"
                className={styles.day}
                data-out={!inMonth || undefined}
                data-today={d === todayDate || undefined}
                aria-pressed={d === selected}
                aria-label={formatLongDate(d)}
                onClick={() => {
                  setSelected(d);
                  if (!inMonth) setMonth(d.slice(0, 7));
                }}
              >
                {parseISODate(d).getDate()}
                <span className={styles.dots}>
                  {m?.has('evaluacion') && <span className={styles.dotEval} />}
                  {m?.has('otro') && <span className={styles.dotEvent} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="row small muted" style={{ gap: 14, fontWeight: 700, padding: '2px 4px 0' }}>
          <span className="row" style={{ gap: 5 }}>
            <span className={styles.dotEval} /> Evaluación
          </span>
          <span className="row" style={{ gap: 5 }}>
            <span className={styles.dotEvent} /> Entrega o evento
          </span>
        </div>
      </div>

      <section className="stack" aria-labelledby="day-title">
        <h2 id="day-title" className="section-title">
          {formatLongDate(selected)}
        </h2>
        {dayEvents.length + dayDeadlines.length + dayTasks.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nada anotado este día.</p>}
        {dayEvents.map((e) => (
          <button key={e.id} type="button" className={`${styles.item} ${styles[e.kind]}`} onClick={() => setEditing(e)}>
            <span className="stack" style={{ gap: 0, textAlign: 'left' }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{e.title}</span>
              <span className="small">
                {EVENT_LABEL[e.kind]}
                {course(e.courseId) && ` · ${course(e.courseId)!.name}`}
              </span>
            </span>
            <span style={{ fontWeight: 800, fontSize: 13 }}>{e.start ? `${e.start}${e.end ? `–${e.end}` : ''}` : 'Todo el día'}</span>
          </button>
        ))}
        {dayDeadlines.map((t) => (
          <button key={t.id} type="button" className={`${styles.item} ${styles.entrega}`} onClick={() => openTaskForm({ taskId: t.id })}>
            <span className="stack" style={{ gap: 0, textAlign: 'left' }}>
              <span style={{ fontWeight: 800, fontSize: 14, textDecoration: t.done ? 'line-through' : undefined }}>{t.title}</span>
              <span className="small">Entrega de tarea</span>
            </span>
          </button>
        ))}
        {dayTasks.map((t) => (
          <button key={t.id} type="button" className={`${styles.item} ${styles.task}`} onClick={() => openTaskForm({ taskId: t.id })}>
            <span style={{ fontWeight: 700, fontSize: 14, textDecoration: t.done ? 'line-through' : undefined }}>{t.title}</span>
            <span className="small muted">{t.estimateMin} min</span>
          </button>
        ))}
      </section>

      <div className="grid-2">
        <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={18} /> Evento
        </button>
        <button type="button" className="btn" style={{ border: '2px solid var(--lavender)' }} onClick={() => openPage('horario')}>
          Horario semanal
        </button>
      </div>

      {upcoming.length > 0 && (
        <section className="card stack" aria-labelledby="up-title">
          <h2 id="up-title" className="section-title">
            Próximas evaluaciones
          </h2>
          {upcoming.map((e) => (
            <div key={e.id} className="row row--between small">
              <span style={{ fontWeight: 700 }}>{e.title}</span>
              <span className="muted">{formatLongDate(e.date)}</span>
            </div>
          ))}
        </section>
      )}

      {editing && (
        <EventForm event={editing === 'new' ? undefined : editing} date={selected} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
