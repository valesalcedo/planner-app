import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { MonthPicker } from '../../components/MonthPicker';
import { Sheet } from '../../components/Sheet';
import { addDays, formatDuration, formatShortDate, startOfWeek, today, tsAt } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { ISODate } from '../../types';
import { CourseDetailView } from './CourseDetailView';
import { ProgressView } from './ProgressView';
import styles from './Stats.module.css';
import { SummaryView } from './SummaryView';

/** "3 – 9 nov" o "27 oct – 2 nov". */
export function weekRange(week: ISODate): string {
  const a = formatShortDate(week);
  const b = formatShortDate(addDays(week, 6));
  return a.split(' ')[1] === b.split(' ')[1] ? `${a.split(' ')[0]} – ${b}` : `${a} – ${b}`;
}

function weekName(week: ISODate, thisWeek: ISODate): string | null {
  if (week === thisWeek) return 'Esta semana';
  if (week === addDays(thisWeek, -7)) return 'Semana pasada';
  return null;
}

/** Pestaña Semana: Progreso (anillos) por defecto, y Resumen con la carga académica. */
export function StatsScreen() {
  const thisWeek = startOfWeek(today());
  const [week, setWeek] = useState(thisWeek);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [picking, setPicking] = useState<'lista' | 'calendario' | null>(null);
  const view = useUI((s) => s.statsView);
  const setView = useUI((s) => s.setStatsView);
  const label = `${formatShortDate(week)} – ${formatShortDate(addDays(week, 6))}`;
  const name = weekName(week, thisWeek);

  if (courseId) {
    return <CourseDetailView courseId={courseId} week={week} label={label} onBack={() => setCourseId(null)} />;
  }

  const go = (w: ISODate) => {
    setWeek(w);
    setPicking(null);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">{name ?? label}</span>
          <h1 className="title">Semana</h1>
        </div>
        <div className="row">
          <button type="button" className="icon-btn" aria-label="Semana anterior" onClick={() => setWeek(addDays(week, -7))}>
            <Icon name="back" />
          </button>
          <button type="button" className="icon-btn" aria-label="Semana siguiente" onClick={() => setWeek(addDays(week, 7))} disabled={week >= thisWeek}>
            <Icon name="next" />
          </button>
        </div>
      </header>

      <button type="button" className={`btn ${styles.weekPick}`} aria-label="Ir a una semana" onClick={() => setPicking('lista')}>
        <Icon name="calendar" size={18} />
        <span>
          {weekRange(week)}
          {name && ` · ${name.toLowerCase()}`}
        </span>
        <Icon name="down" size={16} />
      </button>

      <div className="segmented" role="group" aria-label="Vista">
        <button type="button" aria-pressed={view === 'progreso'} onClick={() => setView('progreso')}>
          Progreso
        </button>
        <button type="button" aria-pressed={view === 'resumen'} onClick={() => setView('resumen')}>
          Resumen
        </button>
      </div>

      {view === 'progreso' ? (
        <ProgressView
          week={week}
          onOpenCourse={(id) => {
            setCourseId(id);
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <SummaryView week={week} />
      )}

      {picking === 'lista' && (
        <WeekListSheet
          week={week}
          thisWeek={thisWeek}
          onPick={go}
          onCalendar={() => setPicking('calendario')}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === 'calendario' && (
        <MonthPicker
          title="Ir a una semana"
          value={week}
          todayDate={today()}
          weekMode
          max={addDays(thisWeek, 6)}
          onPick={(d) => go(startOfWeek(d))}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

const WEEKS_SHOWN = 10;

interface WeekListProps {
  week: ISODate;
  thisWeek: ISODate;
  onPick: (week: ISODate) => void;
  onCalendar: () => void;
  onClose: () => void;
}

/** Las últimas semanas, con sus horas de foco, para saltar directo a una. */
function WeekListSheet({ week, thisWeek, onPick, onCalendar, onClose }: WeekListProps) {
  const entries = useStore((s) => s.entries);
  const weeks = useMemo(() => Array.from({ length: WEEKS_SHOWN }, (_, i) => addDays(thisWeek, -7 * i)), [thisWeek]);
  const focus = useMemo(() => {
    const out = new Map<ISODate, number>();
    for (const w of weeks) {
      const from = tsAt(w, 0);
      const to = tsAt(addDays(w, 7), 0);
      let min = 0;
      for (const e of entries) if (e.end > from && e.start < to) min += (Math.min(e.end, to) - Math.max(e.start, from)) / 60000;
      out.set(w, min);
    }
    return out;
  }, [weeks, entries]);

  return (
    <Sheet title="Ir a una semana" onClose={onClose}>
      <div className="stack">
        <ul className={`card ${styles.weekList}`}>
          {weeks.map((w) => {
            const name = weekName(w, thisWeek);
            return (
              <li key={w}>
                <button type="button" className={styles.weekItem} aria-pressed={w === week} onClick={() => onPick(w)}>
                  <span className="stack" style={{ gap: 0, flex: 1 }}>
                    <span style={{ fontWeight: 800 }}>{weekRange(w)}</span>
                    {name && <span className="small muted">{name}</span>}
                  </span>
                  <span className="small muted" style={{ fontWeight: 700 }}>
                    {formatDuration(Math.round(focus.get(w) ?? 0))} de foco
                  </span>
                  {w === week && <Icon name="check" size={18} style={{ color: 'var(--primary-deep)' }} />}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn" onClick={onCalendar}>
          <Icon name="calendar" size={18} /> Elegir en el calendario…
        </button>
      </div>
    </Sheet>
  );
}
