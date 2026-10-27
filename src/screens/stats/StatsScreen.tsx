import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { addDays, formatShortDate, startOfWeek, today } from '../../lib/time';
import { useUI } from '../../store/useUI';
import { CourseDetailView } from './CourseDetailView';
import { ProgressView } from './ProgressView';
import { SummaryView } from './SummaryView';

/** Pestaña Semana: Progreso (anillos) por defecto, y Resumen con la carga académica. */
export function StatsScreen() {
  const thisWeek = startOfWeek(today());
  const [week, setWeek] = useState(thisWeek);
  const [courseId, setCourseId] = useState<string | null>(null);
  const view = useUI((s) => s.statsView);
  const setView = useUI((s) => s.setStatsView);
  const label = `${formatShortDate(week)} – ${formatShortDate(addDays(week, 6))}`;

  if (courseId) {
    return <CourseDetailView courseId={courseId} week={week} label={label} onBack={() => setCourseId(null)} />;
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">{week === thisWeek ? `Esta semana · ${label}` : label}</span>
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
        <SummaryView week={week} setWeek={setWeek} />
      )}
    </div>
  );
}
