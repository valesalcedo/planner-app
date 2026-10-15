import { Icon } from '../../components/Icon';
import { useLookups } from '../../hooks/useDerived';
import { loggedMinutes } from '../../lib/scheduler';
import { formatDuration, formatShortDate } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { ISODate, Task } from '../../types';
import styles from './Today.module.css';

interface Props {
  tasks: Task[];
  date: ISODate;
}

export function TaskList({ tasks, date }: Props) {
  const entries = useStore((s) => s.entries);
  const setTaskDone = useStore((s) => s.setTaskDone);
  const setSubtaskDone = useStore((s) => s.setSubtaskDone);
  const startTimer = useStore((s) => s.startTimer);
  const openTaskForm = useUI((s) => s.openTaskForm);
  const setTab = useUI((s) => s.setTab);
  const { course } = useLookups();
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
                {course(t.courseId) && ` · ${course(t.courseId)!.name}`}
                {t.date < date && ` · atrasada desde el ${formatShortDate(t.date)}`}
              </span>
            </button>
            {!t.done && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Empezar "${t.title}"`}
                onClick={() => {
                  const next = t.subtasks.find((s) => !s.done);
                  startTimer(t.id, next?.id);
                  setTab('foco');
                }}
              >
                <Icon name="play" size={18} />
              </button>
            )}
          </div>
          {t.subtasks.length > 0 && (
            <ul className={styles.subList}>
              {t.subtasks.map((s) => (
                <li key={s.id}>
                  <label className="row">
                    <span className="check-hit">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={s.done}
                        onChange={(e) => setSubtaskDone(t.id, s.id, e.target.checked)}
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
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
