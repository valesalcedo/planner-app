import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Icon } from '../../components/Icon';
import { Ring } from '../../components/Ring';
import { useLookups } from '../../hooks/useDerived';
import { ringTone } from '../../lib/color';
import { weekProgress } from '../../lib/progress';
import { weekStats } from '../../lib/stats';
import { formatDuration } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { ISODate } from '../../types';
import styles from './Progress.module.css';

interface Props {
  week: ISODate;
  onOpenCourse: (courseId: string) => void;
}

/** "45 min", "1 h 10", "2 h": corto para que quepa en las tarjetas chicas. */
function compact(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const r = m % 60;
  return r ? `${Math.floor(m / 60)} h ${r}` : `${m / 60} h`;
}

const pct = (done: number, total: number) => (total > 0 ? done / total : 0);

export function ProgressView({ week, onOpenCourse }: Props) {
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
  const { course } = useLookups();
  const openPage = useUI((s) => s.openPage);
  const progress = useMemo(() => weekProgress(data, week), [data, week]);
  const stats = useMemo(() => weekStats(data, week), [data, week]);

  const { done, total, prevDone } = progress;
  const share = pct(done, total);
  const diff = done - prevDone;
  const compare =
    done === 0 && prevDone === 0
      ? null
      : diff > 0
        ? `${diff} ${diff === 1 ? 'tarea más' : 'tareas más'} que la semana pasada`
        : diff === 0
          ? 'Igual que la semana pasada'
          : `A ${-diff} ${diff === -1 ? 'tarea' : 'tareas'} de igualar la semana pasada`;
  const att = stats.attendance;
  const marked = att.fui + att.falte;

  return (
    <>
      <section className="card card--lg stack" style={{ gap: 14 }} aria-labelledby="prog-title">
        <h2 id="prog-title" className="sr-only">
          Resumen de la semana
        </h2>
        <div className={styles.hero}>
          <Ring
            value={share}
            size={140}
            stroke={14}
            color="var(--primary-strong)"
            track="var(--primary-tint)"
            label={total > 0 ? `${Math.round(share * 100)}% de las tareas completadas` : 'Sin tareas esta semana'}
          >
            <span className={styles.bigPct}>{total > 0 ? `${Math.round(share * 100)}%` : '—'}</span>
            <span className="small muted" style={{ fontWeight: 700 }}>
              completado
            </span>
          </Ring>
          <div className="stack" style={{ gap: 10, minWidth: 0 }}>
            <div className="stack" style={{ gap: 0 }}>
              <span className={styles.figure}>
                {done} de {total}
              </span>
              <span className="small muted">{total === 1 ? 'tarea lista' : 'tareas listas'}</span>
            </div>
            <div className="stack" style={{ gap: 0 }}>
              <span className={styles.figure}>{formatDuration(progress.focusMin)}</span>
              <span className="small muted">de foco</span>
            </div>
          </div>
        </div>
        {compare && (
          <div className={styles.compare}>
            <Icon name="trend" size={18} />
            {compare}
          </div>
        )}
      </section>

      <h2 className="section-title">Por ramo</h2>
      {progress.courses.length === 0 ? (
        <div className="empty">
          {data.courses.length === 0 ? (
            <>
              Agrega tus ramos en{' '}
              <button type="button" className={styles.link} onClick={() => openPage('ajustes')}>
                Ajustes
              </button>{' '}
              para ver tu avance en cada uno.
            </>
          ) : (
            'Cuando tengas tareas o tiempo en un ramo esta semana, aparece aquí.'
          )}
        </div>
      ) : (
        <ul className={styles.courses}>
          {progress.courses.map((c) => {
            const info = course(c.courseId);
            const color = info?.color ?? '#DCD6F7';
            const share = pct(c.done, c.total);
            return (
              <li key={c.courseId}>
                <button type="button" className={styles.course} onClick={() => onOpenCourse(c.courseId)}>
                  <Ring
                    value={share}
                    size={64}
                    stroke={8}
                    color={ringTone(color)}
                    track={color}
                    label={c.total > 0 ? `${Math.round(share * 100)}% completado` : 'Sin tareas'}
                  >
                    <span className={styles.smallPct}>{c.total > 0 ? `${Math.round(share * 100)}%` : '—'}</span>
                  </Ring>
                  <span className={styles.courseName}>{info?.name ?? 'Ramo'}</span>
                  <span className={styles.courseMeta}>
                    {c.done} de {c.total} · {compact(c.focusMin)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid-2">
        {marked > 0 && (
          <div className={styles.tile} style={{ background: 'var(--lavender)', color: 'var(--lavender-ink)' }}>
            <span className={styles.figure} style={{ color: 'var(--ink)' }}>
              {att.fui} de {marked}
            </span>
            <span className="small" style={{ fontWeight: 700 }}>
              clases a las que fuiste
            </span>
          </div>
        )}
        <div className={styles.tile} style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
          <span className={styles.figure} style={{ color: 'var(--on-accent)' }}>
            +{stats.starsEarned}
          </span>
          <span className="small" style={{ fontWeight: 700 }}>
            estrellas esta semana
          </span>
        </div>
      </div>
    </>
  );
}
