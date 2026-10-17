import { type FormEvent, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useStreak } from '../../hooks/useDerived';
import { starsForFocus } from '../../lib/rewards';
import { addDays, formatDuration, formatShortDate, hhmmToMin, minToHHMM, minutesOfDay, toISODate, today, tsAt } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import styles from './TimeLog.module.css';

const QUICK = [30, 60, 90, 120];

/** Hoja para registrar tiempo trabajado a mano, por si no activaste el cronómetro. */
export function TimeLogForm() {
  const state = useUI((s) => s.timeLog);
  const close = useUI((s) => s.closeTimeLog);
  const showToast = useUI((s) => s.showToast);
  const tasks = useStore((s) => s.tasks);
  const entries = useStore((s) => s.entries);
  const settings = useStore((s) => s.settings);
  const addManualEntry = useStore((s) => s.addManualEntry);
  const deleteEntry = useStore((s) => s.deleteEntry);
  const { multiplier } = useStreak();

  const todayDate = today();
  // Pendientes y las terminadas en las últimas dos semanas (a veces se registra después de terminar).
  const options = useMemo(() => {
    const since = tsAt(addDays(todayDate, -14), 0);
    return tasks
      .filter((t) => !t.done || (t.doneAt ?? 0) >= since || t.id === state?.taskId)
      .sort((a, b) => Number(a.done) - Number(b.done) || b.date.localeCompare(a.date));
  }, [tasks, todayDate, state?.taskId]);

  const nowMin = Math.floor(minutesOfDay(Date.now()) / 5) * 5;
  const [taskId, setTaskId] = useState(state?.taskId ?? options[0]?.id ?? '');
  const [subtaskId, setSubtaskId] = useState('');
  const [date, setDate] = useState(todayDate);
  const [end, setEnd] = useState(minToHHMM(nowMin));
  const [start, setStart] = useState(minToHHMM(Math.max(0, nowMin - 60)));

  const task = tasks.find((t) => t.id === taskId);
  const from = hhmmToMin(start);
  const to = hhmmToMin(end);
  const minutes = to - from;
  const inFuture = date > todayDate || (date === todayDate && to > minutesOfDay(Date.now()));
  const error = !task
    ? 'Elige una tarea'
    : minutes <= 0
      ? 'La hora de término tiene que ser después del inicio'
      : inFuture
        ? 'Esa hora todavía no pasa'
        : null;

  const startTs = tsAt(date, from);
  const endTs = tsAt(date, to);
  const overlaps = !error && entries.some((e) => e.start < endTs && e.end > startTs);

  const taskEntries = entries
    .filter((e) => e.taskId === taskId)
    .sort((a, b) => b.start - a.start)
    .slice(0, 8);

  const setDuration = (min: number) => setStart(minToHHMM(Math.max(0, to - min)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (error || !task) return;
    const earned = addManualEntry({ taskId, subtaskId: subtaskId || undefined, date, start, end });
    if (earned === null) return;
    showToast(earned > 0 ? `${formatDuration(minutes)} agregados · +${earned} estrellas` : 'Tiempo agregado');
    close();
  };

  return (
    <Sheet
      title="Agregar tiempo"
      onClose={close}
      footer={
        <button type="submit" form="time-log" className="btn btn--primary btn--block" disabled={!!error}>
          Guardar {minutes > 0 && !error ? formatDuration(minutes) : ''}
        </button>
      }
    >
      <form id="time-log" className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <p className="small muted" style={{ margin: 0 }}>
          ¿Se te olvidó el cronómetro? Anota lo que trabajaste y cuenta igual para tus estadísticas y estrellas.
        </p>

        {options.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>Primero agrega una tarea para poder registrarle tiempo.</p>
        ) : (
          <div className="field">
            <label htmlFor="tl-task">Tarea</label>
            <select
              id="tl-task"
              className="input"
              value={taskId}
              onChange={(e) => {
                setTaskId(e.target.value);
                setSubtaskId('');
              }}
            >
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.done ? '✓ ' : ''}
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {task && task.subtasks.length > 0 && (
          <div className="field">
            <label htmlFor="tl-sub">Subtarea</label>
            <select id="tl-sub" className="input" value={subtaskId} onChange={(e) => setSubtaskId(e.target.value)}>
              <option value="">Toda la tarea</option>
              {task.subtasks.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="tl-date">Día</label>
          <input id="tl-date" type="date" className="input" value={date} max={todayDate} onChange={(e) => setDate(e.target.value || todayDate)} required />
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="tl-start">Desde</label>
            <input id="tl-start" type="time" className="input" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="tl-end">Hasta</label>
            <input id="tl-end" type="time" className="input" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} required />
          </div>
        </div>

        <div className="pills" role="group" aria-label="Duración rápida">
          {QUICK.map((m) => (
            <button key={m} type="button" className="pill" aria-pressed={minutes === m} onClick={() => setDuration(m)}>
              {formatDuration(m)}
            </button>
          ))}
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : (
          <div className={styles.preview}>
            <span>{formatDuration(minutes)}</span>
            <span className={styles.stars}>
              <Icon name="star" size={16} />+{starsForFocus(minutes, settings, multiplier)}
            </span>
          </div>
        )}
        {overlaps && <p className="small muted" style={{ margin: '-8px 0 0' }}>Ojo: se cruza con otro tiempo que ya registraste.</p>}

        {taskEntries.length > 0 && (
          <section className="stack" aria-labelledby="tl-list">
            <h3 id="tl-list" className="field-label" style={{ margin: 0 }}>
              Registros de esta tarea
            </h3>
            <ul className={styles.list}>
              {taskEntries.map((e) => {
                const day = toISODate(new Date(e.start));
                const sub = task?.subtasks.find((s) => s.id === e.subtaskId);
                return (
                  <li key={e.id} className={styles.entry}>
                    <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                      <span className="small" style={{ fontWeight: 700 }}>
                        {day === todayDate ? 'Hoy' : formatShortDate(day)} · {minToHHMM(minutesOfDay(e.start))}–{minToHHMM(minutesOfDay(e.end))}
                      </span>
                      <span className="small muted">
                        {formatDuration((e.end - e.start) / 60000)}
                        {sub && ` · ${sub.title}`}
                        {e.manual ? ' · a mano' : ' · cronómetro'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="icon-btn icon-btn--plain"
                      aria-label="Borrar este registro"
                      onClick={() => {
                        if (confirm('¿Borrar este registro de tiempo? Se quitan también sus estrellas.')) deleteEntry(e.id);
                      }}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </form>
    </Sheet>
  );
}
