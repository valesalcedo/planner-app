import { Icon } from '../../components/Icon';
import { useLookups } from '../../hooks/useDerived';
import { loggedMinutes } from '../../lib/scheduler';
import { type SubtaskDays, isSplit, isSpread, minutesOn, subtaskDay } from '../../lib/spread';
import { WEEKDAYS, addDays, formatDuration, formatShortDate, weekdayOf } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { ISODate, Subtask, Task } from '../../types';
import styles from './Today.module.css';

interface Props {
  tasks: Task[];
  date: ISODate;
  /** Día de cada subtarea repartida entre varios días. */
  days: SubtaskDays;
  todayDate: ISODate;
}

/** "hoy", "mañana" o "mié 28 oct". */
export function dayLabel(d: ISODate, todayDate: ISODate): string {
  if (d === todayDate) return 'hoy';
  if (d === addDays(todayDate, 1)) return 'mañana';
  return `${WEEKDAYS[weekdayOf(d)].slice(0, 3).toLowerCase()} ${formatShortDate(d)}`;
}

export function TaskList({ tasks, date, days, todayDate }: Props) {
  const entries = useStore((s) => s.entries);
  const setTaskDone = useStore((s) => s.setTaskDone);
  const startTimer = useStore((s) => s.startTimer);
  const openTaskForm = useUI((s) => s.openTaskForm);
  const openTimeLog = useUI((s) => s.openTimeLog);
  const setTab = useUI((s) => s.setTab);
  const { course, category } = useLookups();
  const { byTask, bySub } = loggedMinutes(entries);

  if (tasks.length === 0) {
    return <p className="empty">Sin tareas para este día. Toca + para agregar la primera.</p>;
  }

  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);

  return (
    <ul className={styles.taskList}>
      {sorted.map((t) => (
        <li key={t.id} className={`card ${t.done ? styles.doneCard : ''}`}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <span className="check-hit">
              <input
                type="checkbox"
                className="checkbox"
                checked={t.done}
                aria-label={`Marcar "${t.title}"`}
                onChange={(e) => setTaskDone(t.id, e.target.checked)}
              />
            </span>
            <button type="button" className={styles.workMain} onClick={() => openTaskForm({ taskId: t.id })}>
              <span className={styles.workTitle} style={t.done ? { textDecoration: 'line-through' } : undefined}>
                {t.title}
              </span>
              <span className="small muted">
                {formatDuration(byTask.get(t.id) ?? 0)} de {formatDuration(t.estimateMin)}
                {isSplit(t, days, todayDate) && ` · ${formatDuration(minutesOn(t, date, days, todayDate))} este día`}
                {t.personal
                  ? ` · ${category(t.categoryId)?.name ?? 'Personal'}`
                  : course(t.courseId) && ` · ${course(t.courseId)!.name}`}
                {isSpread(t)
                  ? ` · entrega ${dayLabel(t.deadline!, todayDate)}`
                  : t.date < date && !t.done && ` · atrasada desde el ${formatShortDate(t.date)}`}
              </span>
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--plain"
              aria-label={`Agregar tiempo a "${t.title}"`}
              onClick={() => openTimeLog({ taskId: t.id })}
            >
              <Icon name="clock" size={18} />
            </button>
            {!t.done && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Empezar "${t.title}"`}
                onClick={() => {
                  const next =
                    t.subtasks.find((s) => !s.done && subtaskDay(t, s, days, todayDate) === date) ??
                    t.subtasks.find((s) => !s.done);
                  startTimer(t.id, next?.id);
                  setTab('foco');
                }}
              >
                <Icon name="play" size={18} />
              </button>
            )}
          </div>
          {t.subtasks.length > 0 && <SubtaskRows task={t} date={date} days={days} todayDate={todayDate} bySub={bySub} />}
        </li>
      ))}
    </ul>
  );
}

interface SubtaskRowsProps {
  task: Task;
  date: ISODate;
  days: SubtaskDays;
  todayDate: ISODate;
  bySub: Map<string, number>;
}

/**
 * Subtareas de la tarea. Si se reparte en varios días, muestra solo las pendientes de este día
 * y resume cuántas quedan para otros días.
 */
function SubtaskRows({ task, date, days, todayDate, bySub }: SubtaskRowsProps) {
  const setSubtaskDone = useStore((s) => s.setSubtaskDone);
  const split = !task.done && isSplit(task, days, todayDate);
  const dayOf = (s: Subtask) => subtaskDay(task, s, days, todayDate);
  const shown = split ? task.subtasks.filter((s) => !s.done && dayOf(s) === date) : task.subtasks;
  const later = split ? task.subtasks.filter((s) => !s.done && dayOf(s) !== date) : [];
  const nextDays = [...new Set(later.map(dayOf))].sort();

  return (
    <ul className={styles.subList}>
      {shown.map((s) => (
        <li key={s.id}>
          <label className="row">
            <span className="check-hit">
              <input
                type="checkbox"
                className="checkbox"
                checked={s.done}
                onChange={(e) => setSubtaskDone(task.id, s.id, e.target.checked)}
              />
            </span>
            <span className="small" style={{ flex: 1, textDecoration: s.done ? 'line-through' : undefined }}>
              {s.title}
            </span>
            <span className="small muted">
              {formatDuration(bySub.get(s.id) ?? 0)} / {formatDuration(s.estimateMin)}
            </span>
          </label>
        </li>
      ))}
      {later.length > 0 && (
        <li className="small muted" style={{ paddingLeft: 4 }}>
          {later.length === 1 ? '1 subtarea más' : `${later.length} subtareas más`} para{' '}
          {nextDays.map((d) => dayLabel(d, todayDate)).join(', ')}
        </li>
      )}
    </ul>
  );
}
