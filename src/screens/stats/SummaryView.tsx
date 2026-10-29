import { Fragment, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useLookups } from '../../hooks/useDerived';
import { NO_CATEGORY, NO_COURSE, loadAsText, loadKey, weekStats, type LoadItem } from '../../lib/stats';
import { addDays, formatDuration, formatHours, formatShortDate, startOfWeek, today, weekdayOf } from '../../lib/time';
import type { ISODate } from '../../types';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import { FocusChart } from './FocusChart';
import styles from './Stats.module.css';

interface Props {
  week: ISODate;
  setWeek: (week: ISODate) => void;
}

/** La vista de siempre de la pestaña Semana: foco, asistencia y carga académica. */
export function SummaryView({ week, setWeek }: Props) {
  const thisWeek = startOfWeek(today());
  const data = useStore(
    useShallow((s) => ({
      entries: s.entries,
      tasks: s.tasks,
      weekly: s.weekly,
      skipped: s.skipped,
      attendance: s.attendance,
      events: s.events,
      stars: s.stars,
      trash: s.trash,
    })),
  );
  const showToast = useUI((s) => s.showToast);
  const logSurveyCopy = useStore((s) => s.logSurveyCopy);
  const { course, category, activityName } = useLookups();
  const openTaskForm = useUI((s) => s.openTaskForm);
  // Filas abiertas de la carga académica, por semana, para que cambiar de semana las cierre.
  const [open, setOpen] = useState<{ week: ISODate; keys: string[] }>({ week, keys: [] });
  const openKeys = open.week === week ? open.keys : [];
  const toggle = (key: string) =>
    setOpen({ week, keys: openKeys.includes(key) ? openKeys.filter((k) => k !== key) : [...openKeys, key] });

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
      logSurveyCopy(thisWeek);
      showToast('Copiado. Pégalo donde lo necesites');
    } catch {
      showToast('No se pudo copiar');
    }
  };

  const personalRows = [...stats.personal.entries()].sort((a, b) =>
    a[0] === NO_CATEGORY ? 1 : b[0] === NO_CATEGORY ? -1 : b[1] - a[1],
  );

  const ratio = stats.estimateRatio;
  const att = stats.attendance;
  const marked = att.fui + att.falte;
  const attPct = marked > 0 ? Math.round((att.fui / marked) * 100) : null;
  const attRows = [...att.byCourse.entries()]
    .filter(([, c]) => c.fui + c.falte > 0)
    .sort((a, b) => b[1].falte - a[1].falte);

  return (
    <>
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

      {att.total > 0 && (
        <section className="card card--lg stack" aria-labelledby="att-title">
          <div className="row row--between">
            <h2 id="att-title" className="section-title">
              Asistencia a clases
            </h2>
            {attPct !== null && <span style={{ fontWeight: 800, fontSize: 18 }}>{attPct}%</span>}
          </div>
          <p className="small" style={{ margin: 0 }}>
            {marked === 0
              ? `Tuviste ${att.total} ${att.total === 1 ? 'clase' : 'clases'} y no has marcado ninguna. Márcalas en Hoy con "Fui" o "Falté".`
              : `Fuiste a ${att.fui} de ${marked} ${marked === 1 ? 'clase marcada' : 'clases marcadas'}${
                  att.total > marked ? ` · ${att.total - marked} sin marcar` : ''
                }.`}
          </p>
          {marked > 0 && (
            <div className="progress" role="progressbar" aria-valuenow={attPct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Asistencia">
              <span style={{ width: `${attPct}%` }} />
            </div>
          )}
          {attRows.length > 1 &&
            attRows.map(([id, c]) => (
              <div key={id} className="row row--between small">
                <span className="row" style={{ gap: 8, minWidth: 0 }}>
                  <span className={styles.swatch} style={{ background: course(id)?.color ?? 'var(--switch-off)' }} aria-hidden="true" />
                  {courseName(id)}
                </span>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>
                  {c.fui}/{c.fui + c.falte}
                  {c.falte > 0 && <span style={{ color: 'var(--primary-deep)' }}> · faltaste {c.falte}</span>}
                </span>
              </div>
            ))}
        </section>
      )}

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
          <button type="button" className="btn btn--sm btn--accent" onClick={copy} disabled={loadRows.length === 0}>
            <Icon name="copy" size={16} /> Copiar
          </button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Horas por ramo y tipo de actividad, sumando clases del horario (menos las que faltaste), evaluaciones y tiempo trabajado en tareas de la U. Toca un tipo para ver qué lo suma.
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
                    <span className={styles.swatch} style={{ background: course(id)?.color ?? 'var(--switch-off)' }} aria-hidden="true" />
                    {courseName(id)}
                  </th>
                  <td>{formatHours(total)}</td>
                </tr>
                {row.map(([act, min]) => {
                  const key = loadKey(id, act);
                  const isOpen = openKeys.includes(key);
                  const items = stats.loadItems.get(key) ?? [];
                  const panelId = `load-${key}`;
                  return (
                    <Fragment key={act}>
                      <tr>
                        <th scope="row" className={styles.sub}>
                          <button
                            type="button"
                            className={`${styles.rowToggle} ${isOpen ? styles.rowToggleOpen : ''}`}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => toggle(key)}
                          >
                            <Icon name="next" size={14} />
                            {activityName(act)}
                          </button>
                        </th>
                        <td className={isOpen ? styles.openValue : undefined}>{formatHours(min)}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={2} className={styles.detailCell}>
                            <ul id={panelId} className={styles.detail}>
                              {items.map((it) => (
                                <li key={it.key} className={styles.detailItem}>
                                  <div className={styles.detailHead}>
                                    {it.taskId ? (
                                      <button
                                        type="button"
                                        className={styles.detailTitle}
                                        onClick={() => openTaskForm({ taskId: it.taskId })}
                                      >
                                        {it.label}
                                      </button>
                                    ) : (
                                      <span className={styles.detailTitle}>{it.label}</span>
                                    )}
                                    <span className={styles.detailMin}>{formatDuration(Math.round(it.min))}</span>
                                  </div>
                                  <span className={styles.bar} aria-hidden="true">
                                    <span style={{ width: `${Math.max(4, Math.round((it.min / min) * 100))}%` }} />
                                  </span>
                                  <span className="small muted">{itemMeta(it)}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            ))}
          </table>
        )}
      </section>

      {personalRows.length > 0 && (
        <section className="card card--lg stack" aria-labelledby="personal-title">
          <div className="row row--between">
            <h2 id="personal-title" className="section-title">
              Tareas personales
            </h2>
            <span style={{ fontWeight: 800 }}>{formatHours(stats.personalTotal)} h</span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Organización y otras cosas que no son de la U. No se suman a la carga académica.
          </p>
          {personalRows.map(([id, min]) => (
            <div key={id} className="row row--between small">
              <span className="row" style={{ gap: 8, minWidth: 0 }}>
                <span className={styles.swatch} style={{ background: category(id)?.color ?? 'var(--switch-off)' }} aria-hidden="true" />
                {id === NO_CATEGORY ? 'Sin categoría' : category(id)?.name ?? 'Categoría borrada'}
              </span>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>{formatHours(min)} h</span>
            </div>
          ))}
        </section>
      )}

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
    </>
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

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function dayLabel(d: ISODate): string {
  return `${WEEKDAYS[weekdayOf(d)]} ${Number(d.slice(8))}`;
}

/** Línea bajo cada parte: qué días sumó y, en tareas, si está hecha o fue agregada a mano. */
function itemMeta(it: LoadItem): string {
  const days = it.days.map(dayLabel).join(', ');
  if (it.kind === 'clase') return `${it.count} ${it.count === 1 ? 'clase' : 'clases'} · ${days}`;
  if (it.kind === 'evaluacion') return `Evaluación · ${days}`;
  const parts = [days, it.done ? 'hecha' : 'sin terminar'];
  if (it.manualMin > 0) {
    parts.push(it.manualMin >= it.min - 0.5 ? 'a mano' : `${formatDuration(Math.round(it.manualMin))} a mano`);
  }
  return parts.join(' · ');
}
