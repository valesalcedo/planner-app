import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import { useLookups } from '../../hooks/useDerived';
import { ringTone } from '../../lib/color';
import { courseDetail, daysUntil, weekProgress } from '../../lib/progress';
import { weekStats } from '../../lib/stats';
import { formatDuration, formatHours, formatShortDate } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { ISODate } from '../../types';
import styles from './Progress.module.css';

interface Props {
  courseId: string;
  week: ISODate;
  label: string;
  onBack: () => void;
}

/** Tonos para las partes de la barra de tiempo (de más a menos oscuro). */
const SEGMENTS = ['var(--primary-deep)', 'var(--primary-strong)', 'var(--primary-soft)', 'var(--lavender)', 'var(--mint)', 'var(--accent)'];

export function CourseDetailView({ courseId, week, label, onBack }: Props) {
  const data = useStore(
    useShallow((s) => ({
      tasks: s.tasks,
      entries: s.entries,
      courses: s.courses,
      weekly: s.weekly,
      skipped: s.skipped,
      attendance: s.attendance,
      events: s.events,
      stars: s.stars,
    })),
  );
  const { course, activityName } = useLookups();
  const openTaskForm = useUI((s) => s.openTaskForm);
  const info = course(courseId);
  const color = info?.color ?? '#DCD6F7';

  const progress = useMemo(() => weekProgress(data, week).courses.find((c) => c.courseId === courseId), [data, week, courseId]);
  const load = useMemo(() => {
    const row = weekStats(data, week).load.get(courseId);
    return [...(row?.entries() ?? [])].filter(([, min]) => min > 0).sort((a, b) => b[1] - a[1]);
  }, [data, week, courseId]);
  const detail = useMemo(() => courseDetail(data, courseId), [data, courseId]);

  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;
  const share = total > 0 ? done / total : 0;
  const loadTotal = load.reduce((s, [, m]) => s + m, 0);
  const evalIn = detail.nextEval ? daysUntil(detail.nextEval.date) : null;

  return (
    <div className="screen">
      <header className="stack" style={{ gap: 8 }}>
        <button type="button" className={styles.back} onClick={onBack}>
          <Icon name="back" size={18} /> Semana
        </button>
        <div className="row" style={{ gap: 16 }}>
          <Ring
            value={share}
            size={88}
            stroke={10}
            color={ringTone(color)}
            track={color}
            label={total > 0 ? `${Math.round(share * 100)}% de las tareas completadas` : 'Sin tareas esta semana'}
          >
            <span className={styles.figure}>{total > 0 ? `${Math.round(share * 100)}%` : '—'}</span>
          </Ring>
          <div className="stack" style={{ gap: 2, minWidth: 0 }}>
            <h1 className="title">{info?.name ?? 'Ramo'}</h1>
            <span className="small muted">
              {done} de {total} {total === 1 ? 'tarea' : 'tareas'} · {formatDuration(progress?.focusMin ?? 0)} de foco
            </span>
            <span className="small muted">{label}</span>
          </div>
        </div>
      </header>

      <section className="card card--lg stack" aria-labelledby="time-title">
        <h2 id="time-title" className="section-title">
          En qué se fue el tiempo
        </h2>
        {load.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Todavía no hay horas de este ramo esta semana.
          </p>
        ) : (
          <>
            <div className={styles.split} aria-hidden="true">
              {load.map(([act, min], i) => (
                <span key={act} style={{ flexGrow: min, background: SEGMENTS[i % SEGMENTS.length] }} />
              ))}
            </div>
            <ul className={styles.legend}>
              {load.map(([act, min], i) => (
                <li key={act}>
                  <span className={styles.swatch} style={{ background: SEGMENTS[i % SEGMENTS.length] }} aria-hidden="true" />
                  <span className={styles.legendName}>{activityName(act)}</span>
                  <span className={styles.legendValue}>
                    {formatHours(min)} h · {Math.round((min / loadTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {detail.marked > 0 && (
        <section className="card card--lg stack" aria-labelledby="att-title">
          <div className="row row--between">
            <h2 id="att-title" className="section-title">
              Asistencia
            </h2>
            <span style={{ fontWeight: 800, color: 'var(--lavender-ink)' }}>
              {detail.fui} de {detail.marked}
            </span>
          </div>
          <div className={styles.dots} role="img" aria-label={`Últimas ${detail.recentClasses.length} clases: fuiste a ${detail.recentClasses.filter((m) => m === 'fui').length}`}>
            {detail.recentClasses.map((m, i) => (
              <span key={i} className={m === 'fui' ? styles.dotOn : styles.dotOff} />
            ))}
          </div>
          {detail.currentRun >= 3 && (
            <span className="small" style={{ fontWeight: 700, color: 'var(--mint-ink)' }}>
              Últimas {detail.currentRun} clases seguidas · sigue así
            </span>
          )}
        </section>
      )}

      {detail.nextEval && evalIn !== null && (
        <section className={styles.eval}>
          <div className="stack" style={{ gap: 0, minWidth: 0 }}>
            <span style={{ fontWeight: 800 }}>{detail.nextEval.title}</span>
            <span className="small" style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>
              {evalIn === 0 ? 'Hoy' : evalIn === 1 ? 'Mañana' : `En ${evalIn} días`}
              {detail.nextEval.start ? ` · ${detail.nextEval.start}` : ''}
            </span>
          </div>
          <span className={styles.evalDate}>{formatShortDate(detail.nextEval.date)}</span>
        </section>
      )}

      <section className="stack" aria-labelledby="pending-title">
        <h2 id="pending-title" className="section-title">
          {detail.pending.length > 0 ? 'Te faltan' : 'Pendientes'}
        </h2>
        {detail.pending.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>
            No tienes tareas pendientes de este ramo.
          </p>
        ) : (
          detail.pending.slice(0, 6).map((t) => {
            const left = t.subtasks.length > 0 ? t.subtasks.filter((s) => !s.done).reduce((s, x) => s + x.estimateMin, 0) : t.estimateMin;
            return (
              <button key={t.id} type="button" className={`card ${styles.pending}`} onClick={() => openTaskForm({ taskId: t.id })}>
                <span className={styles.pendingTitle}>{t.title}</span>
                <span className="small muted" style={{ flexShrink: 0 }}>
                  {t.deadline ? `${formatShortDate(t.deadline)} · ` : ''}
                  {formatDuration(left)}
                </span>
              </button>
            );
          })
        )}
        {detail.pending.length > 6 && <span className="small muted">Y {detail.pending.length - 6} más.</span>}
      </section>
    </div>
  );
}
