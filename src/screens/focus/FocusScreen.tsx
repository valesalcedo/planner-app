import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { StarBadge } from '../../components/StarBadge';
import { useStreak } from '../../hooks/useDerived';
import { useNow } from '../../hooks/useNow';
import { loggedMinutes } from '../../lib/scheduler';
import { starsForFocus } from '../../lib/rewards';
import { formatClock, formatDuration, today } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import styles from './Focus.module.css';

interface Selection {
  taskId: string;
  subtaskId?: string;
}

const RING_R = 112;
const RING_LEN = 2 * Math.PI * RING_R;

export function FocusScreen() {
  const now = useNow(1000);
  const tasks = useStore((s) => s.tasks);
  const entries = useStore((s) => s.entries);
  const settings = useStore((s) => s.settings);
  const activeTimer = useStore((s) => s.activeTimer);
  const startTimer = useStore((s) => s.startTimer);
  const stopTimer = useStore((s) => s.stopTimer);
  const setTaskDone = useStore((s) => s.setTaskDone);
  const setSubtaskDone = useStore((s) => s.setSubtaskDone);
  const showToast = useUI((s) => s.showToast);
  const { multiplier } = useStreak();

  const [paused, setPaused] = useState<Selection | null>(null);
  const [picking, setPicking] = useState(false);
  const selection: Selection | null = activeTimer ?? paused;
  const task = tasks.find((t) => t.id === selection?.taskId);
  const subtask = task?.subtasks.find((s) => s.id === selection?.subtaskId);

  const { byTask, bySub } = loggedMinutes(entries);
  const elapsedMs = activeTimer ? now - activeTimer.startedAt : 0;
  const before = subtask ? bySub.get(subtask.id) ?? 0 : task ? byTask.get(task.id) ?? 0 : 0;
  const estimate = subtask?.estimateMin ?? task?.estimateMin ?? 0;
  const progress = estimate > 0 ? Math.min(1, (before + elapsedMs / 60000) / estimate) : 0;
  const sessionStars = starsForFocus(elapsedMs / 60000, settings, multiplier);

  const pause = () => {
    if (!activeTimer) return;
    setPaused({ taskId: activeTimer.taskId, subtaskId: activeTimer.subtaskId });
    const earned = stopTimer();
    showToast(earned > 0 ? `+${earned} estrellas guardadas` : 'Pausa (menos de 30 s no se registra)');
  };

  const finish = () => {
    if (!task) return;
    if (subtask) setSubtaskDone(task.id, subtask.id, true);
    else setTaskDone(task.id, true);
    const nextSub = subtask ? task.subtasks.find((s) => !s.done && s.id !== subtask.id) : undefined;
    setPaused(nextSub ? { taskId: task.id, subtaskId: nextSub.id } : null);
    showToast(subtask ? '¡Subtarea lista!' : '¡Tarea terminada! Bono de estrellas sumado');
  };

  const pending = tasks.filter((t) => !t.done && t.date <= today(new Date(now)));

  if (!task || picking) {
    return (
      <div className="screen">
        <header className="screen-header">
          <h1 className="title">Modo foco</h1>
          <StarBadge />
        </header>
        <p className="muted" style={{ margin: 0 }}>
          Elige en qué vas a trabajar. Ganas {settings.starsPerMinute} estrella por minuto
          {multiplier > 1 && `, ×${multiplier} por tu racha`}.
        </p>
        {pending.length === 0 ? (
          <p className="empty">No tienes tareas pendientes para hoy. ¡Bien!</p>
        ) : (
          <ul className={styles.pickList}>
            {pending.map((t) => {
              const subs = t.subtasks.filter((s) => !s.done);
              return (
                <li key={t.id} className="card stack">
                  <div className="row row--between">
                    <div className="stack" style={{ gap: 0, minWidth: 0 }}>
                      <span style={{ fontWeight: 800 }}>{t.title}</span>
                      <span className="small muted">
                        {formatDuration(byTask.get(t.id) ?? 0)} de {formatDuration(t.estimateMin)}
                      </span>
                    </div>
                    {subs.length === 0 && (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={() => {
                          startTimer(t.id);
                          setPicking(false);
                        }}
                      >
                        <Icon name="play" size={14} /> Empezar
                      </button>
                    )}
                  </div>
                  {subs.length > 0 && (
                    <div className="pills">
                      {subs.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="pill"
                          onClick={() => {
                            startTimer(t.id, s.id);
                            setPicking(false);
                          }}
                        >
                          {s.title} · {s.estimateMin} min
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {task && (
          <button type="button" className="btn" onClick={() => setPicking(false)}>
            Volver al cronómetro
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`screen ${styles.focusScreen}`}>
      <header className="screen-header">
        <button type="button" className="btn btn--sm" onClick={() => setPicking(true)}>
          Cambiar tarea
        </button>
        <StarBadge />
      </header>

      <div className={styles.center}>
        <div className="stack" style={{ alignItems: 'center', gap: 2, textAlign: 'center' }}>
          {subtask && <span className={styles.eyebrow}>{task.title}</span>}
          <h1 className={styles.taskTitle}>{subtask?.title ?? task.title}</h1>
        </div>

        <div className={styles.ring}>
          <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r={RING_R} fill="var(--surface)" stroke="var(--primary-soft)" strokeWidth="16" />
            <circle
              cx="130"
              cy="130"
              r={RING_R}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={RING_LEN}
              strokeDashoffset={RING_LEN * (1 - progress)}
              transform="rotate(-90 130 130)"
            />
          </svg>
          <div className={styles.ringLabel}>
            <span className={styles.clock} role="timer" aria-live="off">
              {formatClock(elapsedMs)}
            </span>
            <span className="small muted" style={{ fontWeight: 700 }}>
              {activeTimer ? 'esta sesión' : 'en pausa'} · {formatDuration(before + elapsedMs / 60000)} de {formatDuration(estimate)}
            </span>
          </div>
        </div>

        {activeTimer && (
          <div className={styles.earned}>
            <Icon name="star" size={18} />+{sessionStars} estrellas en esta sesión
          </div>
        )}

        <div className="row" style={{ gap: 12 }}>
          {activeTimer ? (
            <button type="button" className="btn" style={{ minHeight: 52, padding: '12px 24px' }} onClick={pause}>
              <Icon name="pause" size={18} /> Pausar
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--main"
              style={{ minHeight: 52, padding: '12px 24px' }}
              onClick={() => startTimer(task.id, subtask?.id)}
            >
              <Icon name="play" size={18} /> {before > 0 ? 'Reanudar' : 'Empezar'}
            </button>
          )}
          <button type="button" className="btn btn--primary" style={{ minHeight: 52, padding: '12px 24px' }} onClick={finish}>
            <Icon name="check" size={18} strokeWidth={2.6} /> Terminar
          </button>
        </div>
      </div>

      <section className="card stack" aria-labelledby="log-title">
        <h2 id="log-title" className="section-title">
          Tiempo registrado en esta tarea
        </h2>
        {task.subtasks.length > 0 ? (
          task.subtasks.map((s) => {
            const live = activeTimer?.subtaskId === s.id ? elapsedMs / 60000 : 0;
            return (
              <div key={s.id} className="row row--between small">
                <span style={{ textDecoration: s.done ? 'line-through' : undefined }}>{s.title}</span>
                <span style={{ fontWeight: 800 }}>
                  {formatDuration((bySub.get(s.id) ?? 0) + live)}{' '}
                  <span className="muted" style={{ fontWeight: 600 }}>
                    / {s.estimateMin} est.
                  </span>
                </span>
              </div>
            );
          })
        ) : null}
        <div className="row row--between" style={{ fontWeight: 800, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <span>Total</span>
          <span>{formatDuration((byTask.get(task.id) ?? 0) + elapsedMs / 60000)}</span>
        </div>
      </section>
    </div>
  );
}
