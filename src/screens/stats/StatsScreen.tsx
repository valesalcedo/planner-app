import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useLookups } from '../../hooks/useDerived';
import { NO_COURSE, loadAsText, weekStats } from '../../lib/stats';
import { addDays, formatHours, formatShortDate, startOfWeek, today } from '../../lib/time';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import { FocusChart } from './FocusChart';
import styles from './Stats.module.css';

export function StatsScreen() {
  const thisWeek = startOfWeek(today());
  const [week, setWeek] = useState(thisWeek);
  const data = useStore(
    useShallow((s) => ({ entries: s.entries, tasks: s.tasks, weekly: s.weekly, skipped: s.skipped, events: s.events, stars: s.stars })),
  );
  const showToast = useUI((s) => s.showToast);
  const { course, activityName } = useLookups();

  const stats = useMemo(() => weekStats(data, week), [data, week]);
  const label = `${formatShortDate(week)} – ${formatShortDate(addDays(week, 6))}`;
  const courseName = (id: string) => (id === NO_COURSE ? 'Sin ramo' : course(id)?.name ?? 'Ramo borrado');
  const loadRows = [...stats.load.entries()]
    .map(([id, row]) => ({ id, row: [...row.entries()], total: [...row.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => (a.id === NO_COURSE ? 1 : b.id === NO_COURSE ? -1 : b.total - a.total));

  const copy = async () => {
    const text = loadAsText(stats.load, courseName, activityName, label);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copiado. Pégalo donde lo necesites');
    } catch {
      showToast('No se pudo copiar');
    }
  };

  const ratio = stats.estimateRatio;

  return (
    <div className="screen">
      <header className="screen-header">
        <div className="stack" style={{ gap: 0 }}>
          <span className="eyebrow">{label}</span>
          <h1 className="title">Mi semana</h1>
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

      <div className="segmented" role="group" aria-label="Semana">
        <button type="button" aria-pressed={week === addDays(thisWeek, -7)} onClick={() => setWeek(addDays(thisWeek, -7))}>
          Semana pasada
        </button>
        <button type="button" aria-pressed={week === thisWeek} onClick={() => setWeek(thisWeek)}>
          Esta semana
        </button>
      </div>

      <div className={styles.tiles}>
        <Tile value={`${formatHours(stats.focusTotal)} h`} label="de foco" />
        <Tile value={`${formatHours(stats.classTotal)} h`} label="de clases" />
        <Tile value={String(stats.tasksDone)} label={stats.tasksDone === 1 ? 'tarea hecha' : 'tareas hechas'} />
        <Tile value={String(stats.starsEarned)} label="estrellas ganadas" star />
      </div>

      <section className="card card--lg stack" aria-labelledby="chart-title">
        <h2 id="chart-title" className="section-title">
          Horas de foco por día
        </h2>
        <FocusChart days={stats.days} values={stats.focusByDay} />
      </section>

      <section className="card card--lg stack" aria-labelledby="load-title">
        <div className="row row--between">
          <h2 id="load-title" className="section-title">
            Carga académica
          </h2>
          <button type="button" className="btn btn--sm btn--yellow" onClick={copy} disabled={loadRows.length === 0}>
            <Icon name="copy" size={16} /> Copiar
          </button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Horas por ramo y tipo de actividad, sumando clases del horario, evaluaciones y tiempo cronometrado.
        </p>
        {loadRows.length === 0 ? (
          <p className="empty" style={{ margin: 0 }}>Todavía no hay registros esta semana.</p>
        ) : (
          <table className={styles.table}>
            <caption className="sr-only">Carga académica de la semana {label}</caption>
            <thead>
              <tr>
                <th scope="col">Actividad</th>
                <th scope="col">Horas</th>
              </tr>
            </thead>
            {loadRows.map(({ id, row, total }) => (
              <tbody key={id}>
                <tr className={styles.courseRow}>
                  <th scope="rowgroup">
                    <span className={styles.swatch} style={{ background: course(id)?.color ?? '#e9d9df' }} aria-hidden="true" />
                    {courseName(id)}
                  </th>
                  <td>{formatHours(total)}</td>
                </tr>
                {row.map(([act, min]) => (
                  <tr key={act}>
                    <th scope="row" className={styles.sub}>
                      {activityName(act)}
                    </th>
                    <td>{formatHours(min)}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </section>

      {ratio !== null && (
        <section className="card stack" aria-labelledby="est-title">
          <h2 id="est-title" className="section-title">
            Tus estimaciones
          </h2>
          <p className="small" style={{ margin: 0 }}>
            {Math.abs(ratio - 1) < 0.1
              ? 'Estimas muy bien: tus tareas te toman casi lo que planeas.'
              : ratio > 1
                ? `Tus tareas terminadas te tomaron un ${Math.round((ratio - 1) * 100)}% más de lo estimado. Prueba sumar un poco de margen.`
                : `Terminaste tus tareas un ${Math.round((1 - ratio) * 100)}% más rápido de lo estimado.`}
          </p>
        </section>
      )}
    </div>
  );
}

function Tile({ value, label, star }: { value: string; label: string; star?: boolean }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileValue}>
        {star && <Icon name="star" size={20} />}
        {value}
      </span>
      <span className="small muted">{label}</span>
    </div>
  );
}
