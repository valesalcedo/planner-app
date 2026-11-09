import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useLookups } from '../../hooks/useDerived';
import { useNow } from '../../hooks/useNow';
import { inkOn } from '../../lib/color';
import type { DoneBlock } from '../../lib/doneBlocks';
import type { DayPlan, Placement, TravelBlock } from '../../lib/scheduler';
import { pinAt, unitKey } from '../../lib/scheduler';
import { addDays, formatDuration, formatShortDate, hhmmToMin, minToHHMM, toISODate, today, tsAt, weekdayOf } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { Attendance, ISODate, Task, TaskPin, TravelLeg, TravelOverride } from '../../types';
import styles from './Today.module.css';
import { type DragPayload, type DropTarget, useDragDrop } from './useDragDrop';

interface Props {
  date: ISODate;
  plan: DayPlan;
  /** Trabajo terminado, en las horas en que se hizo. */
  doneBlocks: DoneBlock[];
  /** Tareas terminadas este día que no tienen tiempo registrado en este día (no tienen hora donde quedarse). */
  doneTasks: Task[];
}

type Row =
  | { type: 'busy'; start: number; end: number; title: string; kind: string; sourceId: string }
  | { type: 'travel'; start: number; end: number; block: TravelBlock }
  | { type: 'work'; start: number; end: number; placement: Placement }
  | { type: 'gap'; start: number; end: number }
  | { type: 'done'; start: number; end: number; block: DoneBlock };

const ORDER = { busy: 0, travel: 1, done: 2, work: 3, gap: 4 } as const;
export const TRAVEL_TITLE: Record<TravelLeg, string> = { ida: 'Ida a la U', vuelta: 'Vuelta a casa' };

/** Lo que está abierto en la hoja "Mover". */
type MoveState = { kind: 'unit'; key: string; title: string; start: number } | { kind: 'travel'; block: TravelBlock };
const DIFF_LABEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' } as const;
const DIFF_CHIP = { facil: 'chip--mint', media: 'chip--lavender', dificil: 'chip--accent' } as const;

export function DayTimeline({ date, plan, doneBlocks, doneTasks }: Props) {
  const tasks = useStore((s) => s.tasks);
  const weekly = useStore((s) => s.weekly);
  const events = useStore((s) => s.events);
  const skipped = useStore((s) => s.skipped[date]);
  const activeTimer = useStore((s) => s.activeTimer);
  const entries = useStore((s) => s.entries);
  const toggleSkip = useStore((s) => s.toggleSkip);
  const attendance = useStore((s) => s.attendance[date]);
  const setAttendance = useStore((s) => s.setAttendance);
  const starsPerClass = useStore((s) => s.settings.starsPerClass);
  const travelMin = useStore((s) => s.settings.travelMin);
  const [addingTravel, setAddingTravel] = useState(false);
  const now = useNow(60_000);
  const startTimer = useStore((s) => s.startTimer);
  const setTaskDone = useStore((s) => s.setTaskDone);
  const setSubtaskDone = useStore((s) => s.setSubtaskDone);
  const moveTask = useStore((s) => s.moveTask);
  const setSubtaskDate = useStore((s) => s.setSubtaskDate);
  const pins = useStore((s) => s.pins[date]);
  const setPin = useStore((s) => s.setPin);
  const setTravel = useStore((s) => s.setTravel);
  const [moving, setMoving] = useState<MoveState | null>(null);
  const setTab = useUI((s) => s.setTab);
  const showToast = useUI((s) => s.showToast);
  const { course, category, blockColor, eventColor } = useLookups();
  /** Ramo de una tarea de la U, o categoría de una personal. */
  const groupName = (t?: Task) => (t?.personal ? category(t.categoryId)?.name ?? 'Personal' : course(t?.courseId)?.name);
  /** Color del ramo (o de la categoría) para su etiqueta. */
  const groupColor = (t?: Task) => (t?.personal ? category(t.categoryId)?.color : course(t?.courseId)?.color);
  const group = (t?: Task) => ({ courseName: groupName(t), courseColor: groupColor(t) });

  const todayDate = today();
  const isPast = date < todayDate;

  const colorOf = (kind: string, sourceId: string): string | undefined => {
    if (kind === 'evento') {
      const ev = events.find((e) => e.id === sourceId);
      return ev ? eventColor(ev) : undefined;
    }
    const b = weekly.find((x) => x.id === sourceId);
    return b ? blockColor(b) : undefined;
  };

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const allDay = events.filter((e) => e.date === date && !e.start);
  const deadlines = tasks.filter((t) => t.deadline === date && !t.done);

  // Lo que quitaste (clases que no hubo, traslados que no harás) no se dibuja en el día:
  // queda solo en "Quitado de este día", al final, por si quieres restaurarlo.
  const skippedBlocks = weekly
    .filter((b) => b.weekday === weekdayOf(date) && (skipped ?? []).includes(b.id))
    .sort((a, b) => hhmmToMin(a.start) - hhmmToMin(b.start));
  // Clases a las que no vas (o faltaste): tampoco se dibujan; se restauran desde el mismo lugar.
  const notGoingBlocks = plan.busy.filter((b) => b.free);
  const removedTravel = plan.travel.filter((t) => t.removed);
  // Traslados que no hay este día (ni automáticos ni quitados): se pueden agregar a mano.
  const missingLegs = (['ida', 'vuelta'] as const).filter((leg) => !plan.travel.some((t) => t.leg === leg));
  const travelLegs = plan.travel.filter((t) => !t.removed);
  // Lo que terminaste mientras ibas en un traslado se queda adentro de su tarjeta.
  const travelLegOf = (b: DoneBlock) => travelLegs.find((t) => b.start >= t.start && b.start < t.end)?.leg;
  const doneInTravel = (leg: TravelBlock['leg']) => doneBlocks.filter((b) => travelLegOf(b) === leg);
  const rows: Row[] = [
    ...plan.busy.filter((b) => !b.free).map((b) => ({ type: 'busy' as const, start: b.start, end: b.end, title: b.title, kind: b.kind, sourceId: b.sourceId })),
    ...travelLegs.map((b) => ({ type: 'travel' as const, start: b.start, end: b.end, block: b })),
    // Lo que va dentro de un traslado se muestra adentro de su tarjeta.
    ...plan.placements.filter((p) => !p.travel).map((p) => ({ type: 'work' as const, start: p.start, end: p.end, placement: p })),
    ...(isPast ? [] : plan.gaps.map((g) => ({ type: 'gap' as const, start: g.start, end: g.end }))),
    ...doneBlocks.filter((b) => !travelLegOf(b)).map((b) => ({ type: 'done' as const, start: b.start, end: b.end, block: b })),
  ].sort((a, b) => a.start - b.start || ORDER[a.type] - ORDER[b.type]);

  const skipClass = (id: string, title: string) => {
    toggleSkip(date, id);
    showToast(`Quitada: ${title}. Puedes restaurarla al final del día`);
  };
  const removedCount = skippedBlocks.length + notGoingBlocks.length + removedTravel.length;

  const pinUnit = (key: string, pin: TaskPin | null) => {
    setPin(date, key, pin);
    if (!pin) showToast('Suelta: la app la ordena sola');
    else if ('travel' in pin) showToast(`Fijada en: ${TRAVEL_TITLE[pin.travel].toLowerCase()}`);
    else showToast(`Fijada a las ${pin.at}`);
  };

  const onDrop = (p: DragPayload, t: DropTarget) => {
    if (t.kind === 'busy') {
      showToast(`Ahí tienes ${t.title}`);
      return;
    }
    if (p.kind === 'unit') {
      pinUnit(p.key, t.kind === 'travel' ? { travel: t.leg } : pinAt(t.min));
    } else if (t.kind === 'time') {
      setTravel(date, p.leg, { start: minToHHMM(t.min) });
      showToast(`${TRAVEL_TITLE[p.leg]} a las ${minToHHMM(t.min)}`);
    }
  };

  const onTap = (p: DragPayload) => {
    if (p.kind === 'travel') {
      const block = plan.travel.find((t) => t.leg === p.leg);
      if (block) setMoving({ kind: 'travel', block });
    } else {
      const placement = plan.placements.find((x) => unitKey(x.unit.taskId, x.unit.subtaskId) === p.key);
      setMoving({ kind: 'unit', key: p.key, title: p.title, start: placement?.start ?? hhmmToMin('09:00') });
    }
  };

  const { drag, handleProps } = useDragDrop(onDrop, onTap);

  const workCard = (p: Placement, inTravel = false) => {
    const key = unitKey(p.unit.taskId, p.unit.subtaskId);
    return (
      <WorkCard
        key={`${key}-${p.start}`}
        placement={p}
        task={taskById.get(p.unit.taskId)}
        date={date}
        {...group(taskById.get(p.unit.taskId))}
        short={!inTravel && (plan.slots.find((s) => p.start >= s.start && p.end <= s.end)?.betweenClasses ?? false)}
        running={activeTimer?.taskId === p.unit.taskId && activeTimer.subtaskId === p.unit.subtaskId}
        dragging={drag?.payload.kind === 'unit' && drag.payload.key === key}
        dropMin={inTravel ? undefined : p.start}
        handle={handleProps({ kind: 'unit', key, title: p.unit.title })}
        onStart={() => start(p)}
        onComplete={() => complete(p)}
      />
    );
  };

  const undo = (b: DoneBlock) => {
    if (b.subtaskId) setSubtaskDone(b.taskId, b.subtaskId, false);
    else setTaskDone(b.taskId, false);
  };
  const rowKey = (row: Row) =>
    row.type === 'busy'
      ? `b-${row.sourceId}`
      : row.type === 'travel'
        ? `t-${row.block.leg}`
        : row.type === 'work'
          ? `w-${row.placement.unit.key}-${row.start}`
          : row.type === 'gap'
            ? `g-${row.start}`
            : `d-${row.block.key}-${row.start}`;

  const start = (p: Placement) => {
    startTimer(p.unit.taskId, p.unit.subtaskId);
    setTab('foco');
  };

  const complete = (p: Placement) => {
    if (p.unit.subtaskId) setSubtaskDone(p.unit.taskId, p.unit.subtaskId, true);
    else setTaskDone(p.unit.taskId, true);
  };

  /** Dónde quedó el tiempo de una tarea terminada que no tiene bloque en este día. */
  const loggedElsewhere = (t: Task) => {
    const mine = entries.filter((e) => e.taskId === t.id);
    if (mine.length === 0) return 'Sin tiempo registrado';
    const min = mine.reduce((s, e) => s + (e.end - e.start) / 60000, 0);
    const days = [...new Set(mine.map((e) => toISODate(new Date(e.start))))].sort();
    const when = days.length === 1 ? `el ${formatShortDate(days[0])}` : `en ${days.length} días`;
    return `${formatDuration(min)} registradas ${when}`;
  };

  // Una misma tarea puede aparecer varias veces si la overflow la parte; mostramos cada tarea una vez.
  const overflowTasks = [...new Map(plan.overflow.map((u) => [u.taskId, u])).values()];

  return (
    <div className="stack" style={{ gap: 10 }}>
      {(allDay.length > 0 || deadlines.length > 0) && (
        <div className="pills">
          {allDay.map((e) => (
            <span key={e.id} className={`chip ${e.kind === 'evaluacion' ? 'chip--accent' : 'chip--main'}`} style={{ fontSize: 13, padding: '6px 10px' }}>
              {e.title}
            </span>
          ))}
          {deadlines.map((t) => (
            <span key={t.id} className="chip chip--main" style={{ fontSize: 13, padding: '6px 10px' }}>
              Vence hoy: {t.title}
            </span>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="empty">
          No hay nada agendado. Agrega tareas con el botón + y yo las ordeno en tus horas libres.
        </p>
      ) : (
        <ol className={styles.timeline}>
          {rows.map((row) => (
            <li key={rowKey(row)} className={styles.timelineRow}>
              <span className={styles.time}>{minToHHMM(row.start)}</span>
              {row.type === 'busy' ? (
                <BusyCard
                  title={row.title}
                  kind={row.kind}
                  color={colorOf(row.kind, row.sourceId)}
                  range={`${minToHHMM(row.start)}–${minToHHMM(row.end)}`}
                  onSkip={row.kind === 'evento' ? undefined : () => skipClass(row.sourceId, row.title)}
                  onNotGoing={
                    row.kind === 'clase' && tsAt(date, row.start) > now
                      ? () => {
                          setAttendance(date, row.sourceId, 'falte');
                          showToast(`No vas a ${row.title}. Puedes restaurarla al final del día`);
                        }
                      : undefined
                  }
                  attendance={
                    row.kind === 'clase' && tsAt(date, row.start) <= now
                      ? {
                          value: attendance?.[row.sourceId] ?? null,
                          stars: starsPerClass,
                          onChange: (v) => {
                            const prev = attendance?.[row.sourceId] ?? null;
                            const next = prev === v ? null : v;
                            setAttendance(date, row.sourceId, next);
                            if (next === 'falte') showToast(`Faltaste a ${row.title}. Puedes restaurarla al final del día`);
                            if (next === 'fui' && starsPerClass > 0) showToast(`¡Bien! +${starsPerClass} estrellas por ir a clases`);
                          },
                        }
                      : undefined
                  }
                />
              ) : row.type === 'travel' ? (
                <TravelCard
                  block={row.block}
                  dragging={drag?.payload.kind === 'travel' && drag.payload.leg === row.block.leg}
                  handle={handleProps({ kind: 'travel', leg: row.block.leg, title: TRAVEL_TITLE[row.block.leg] })}
                >
                  {[
                    ...doneInTravel(row.block.leg).map((b) => ({
                      start: b.start,
                      node: (
                        <DoneCard
                          key={`done-${b.key}-${b.start}`}
                          block={b}
                          {...group(taskById.get(b.taskId))}
                          onUndo={() => undo(b)}
                        />
                      ),
                    })),
                    ...plan.placements
                      .filter((p) => p.travel === row.block.leg)
                      .map((p) => ({ start: p.start, node: workCard(p, true) })),
                  ]
                    .sort((a, b) => a.start - b.start)
                    .map((x) => x.node)}
                </TravelCard>
              ) : row.type === 'gap' ? (
                <div className={styles.gap} data-drop="time" data-min={row.start}>
                  Libre · {formatDuration(row.end - row.start)}
                </div>
              ) : row.type === 'done' ? (
                <DoneCard
                  block={row.block}
                  {...group(taskById.get(row.block.taskId))}
                  onUndo={() => undo(row.block)}
                />
              ) : (
                workCard(row.placement)
              )}
            </li>
          ))}
        </ol>
      )}

      {overflowTasks.length > 0 && (
        <section className="card stack" aria-labelledby="overflow-title">
          <h2 id="overflow-title" className="section-title">
            No alcanza hoy
          </h2>
          {overflowTasks.map((u) => {
            const t = taskById.get(u.taskId);
            const remaining = plan.overflow.filter((o) => o.taskId === u.taskId).reduce((s, o) => s + o.remainingMin, 0);
            return (
              <div key={u.taskId} className="row row--between">
                <div className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{u.taskTitle}</span>
                  <span className="small muted">
                    Faltan {formatDuration(remaining)}
                    {u.tier === 0 && ' · vence hoy, busca un espacio'}
                  </span>
                </div>
                {u.tier !== 0 && t && (
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => {
                      const tomorrow = addDays(date, 1);
                      const subs = plan.overflow.filter((o) => o.taskId === t.id && o.subtaskId);
                      // Las subtareas que no alcanzan pasan a mañana; lo que sí cabe hoy se queda.
                      if (subs.length > 0) subs.forEach((o) => setSubtaskDate(t.id, o.subtaskId!, tomorrow));
                      else moveTask(t.id, tomorrow);
                      showToast(subs.length > 1 ? 'Subtareas movidas a mañana' : subs.length === 1 ? 'Subtarea movida a mañana' : 'Movida a mañana');
                    }}
                  >
                    A mañana
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {drag && (
        <div className={styles.ghost} style={{ left: Math.min(Math.max(drag.x, 110), window.innerWidth - 110), top: drag.y }} aria-hidden="true">
          {drag.payload.title}
        </div>
      )}

      {moving && (
        <MoveSheet
          state={moving}
          travel={travelLegs}
          pin={moving.kind === 'unit' ? pins?.[moving.key] : undefined}
          onClose={() => setMoving(null)}
          onPin={(pin) => {
            if (moving.kind === 'unit') pinUnit(moving.key, pin);
            setMoving(null);
          }}
          onTravel={(patch) => {
            if (moving.kind === 'travel') {
              const { leg, added } = moving.block;
              if (patch?.removed && added) {
                // Uno agregado a mano simplemente se borra.
                setTravel(date, leg, null);
                showToast(`Quitado: ${TRAVEL_TITLE[leg].toLowerCase()}`);
              } else {
                setTravel(date, leg, patch);
                if (patch?.removed) showToast(`Quitada: ${TRAVEL_TITLE[leg].toLowerCase()}. Puedes restaurarla al final del día`);
              }
            }
            setMoving(null);
          }}
        />
      )}

      {!isPast && missingLegs.length > 0 && (
        <button type="button" className={`btn ${styles.addTravel}`} onClick={() => setAddingTravel(true)}>
          <Icon name="bus" size={18} /> Agregar traslado
        </button>
      )}

      {addingTravel && (
        <TravelSheet
          title="Agregar traslado"
          legs={missingLegs}
          initial={{ leg: missingLegs[0], start: missingLegs[0] === 'vuelta' ? '18:00' : '09:00', durationMin: travelMin }}
          onClose={() => setAddingTravel(false)}
          onSave={({ leg, start, durationMin }) => {
            setTravel(date, leg, { added: true, start, durationMin, removed: undefined });
            showToast(`${TRAVEL_TITLE[leg]} agregada`);
            setAddingTravel(false);
          }}
        />
      )}

      {removedCount > 0 && (
        <details className={styles.removed}>
          <summary className={styles.removedSummary}>Quitado de este día ({removedCount})</summary>
          <ul className={styles.removedList}>
            {skippedBlocks.map((b) => (
              <li key={b.id} className={styles.removedItem}>
                <span className={styles.removedText}>
                  {b.title} · {b.start}–{b.end}
                </span>
                <button type="button" className="btn btn--sm" onClick={() => toggleSkip(date, b.id)}>
                  Restaurar
                </button>
              </li>
            ))}
            {notGoingBlocks.map((b) => (
              <li key={`ng-${b.sourceId}`} className={styles.removedItem}>
                <span className={styles.removedText}>
                  {b.title} · {minToHHMM(b.start)}–{minToHHMM(b.end)} · {tsAt(date, b.start) > now ? 'no vas' : 'faltaste'}
                </span>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    setAttendance(date, b.sourceId, null);
                    showToast(`Restaurada: ${b.title}`);
                  }}
                >
                  Restaurar
                </button>
              </li>
            ))}
            {removedTravel.map((t) => (
              <li key={t.leg} className={styles.removedItem}>
                <span className={styles.removedText}>{TRAVEL_TITLE[t.leg]}</span>
                <button type="button" className="btn btn--sm" onClick={() => setTravel(date, t.leg, null)}>
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {doneTasks.length > 0 && (
        <details className="card" open>
          <summary className="section-title" style={{ cursor: 'pointer', minHeight: 28 }}>
            Terminadas este día ({doneTasks.length})
          </summary>
          <ul className={styles.doneList}>
            {doneTasks.map((t) => (
              <li key={t.id}>
                <label className="row" style={{ alignItems: 'flex-start' }}>
                  <span className="check-hit">
                    <input type="checkbox" className="checkbox" aria-label={`Desmarcar "${t.title}"`} checked onChange={() => setTaskDone(t.id, false)} />
                  </span>
                  <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                    <span className="muted" style={{ textDecoration: 'line-through' }}>
                      {t.title}
                    </span>
                    <span className="small muted">{loggedElsewhere(t)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

interface BusyCardProps {
  title: string;
  kind: string;
  color?: string;
  range: string;
  /** Quitarla de este día ("no hay" / "no hubo"). */
  onSkip?: () => void;
  /** Solo clases que ya empezaron: marcar si fuiste. */
  attendance?: { value: Attendance | null; stars: number; onChange: (v: Attendance) => void };
  /** Solo clases que todavía no empiezan: avisar de antemano que no vas. */
  onNotGoing?: () => void;
}

const DEFAULT_BG: Record<string, string> = { clase: '#DCD6F7', actividad: '#C9EBD8', evento: '#FDE68A' };

function BusyCard({ title, kind, color, range, onSkip, attendance, onNotGoing }: BusyCardProps) {
  const bg = color ?? DEFAULT_BG[kind] ?? DEFAULT_BG.clase;
  const ink = inkOn(bg);
  const label = kind === 'clase' ? 'Clase' : kind === 'actividad' ? 'Actividad' : 'Evento';
  const status = attendance?.value === 'fui' ? ' · fuiste' : '';

  return (
    <div className={styles.block} style={{ background: bg, color: ink }} data-drop="busy" data-title={kind === 'clase' ? 'clase' : title}>
      <div className={styles.blockHead}>
        <div className="stack" style={{ gap: 0, minWidth: 0 }}>
          <span className={styles.blockTitle}>{title}</span>
          <span className="small">
            {label} · {range}
            {status}
          </span>
        </div>
        {onSkip && !attendance && !onNotGoing && (
          <button type="button" className={`btn btn--sm ${styles.blockBtn}`} onClick={onSkip}>
            No hay
          </button>
        )}
      </div>
      {onNotGoing && (
        <div className={`${styles.attend} ${onSkip ? styles.attendTwo : ''}`} role="group" aria-label={`Asistencia a ${title}`}>
          <button type="button" className={styles.attendBtn} onClick={onNotGoing}>
            No voy
          </button>
          {onSkip && (
            <button type="button" className={styles.attendBtn} onClick={onSkip}>
              No hay
            </button>
          )}
        </div>
      )}
      {attendance && (
        <div className={styles.attend} role="group" aria-label={`Asistencia a ${title}`}>
          <button type="button" className={styles.attendBtn} aria-pressed={attendance.value === 'fui'} onClick={() => attendance.onChange('fui')}>
            <Icon name="check" size={16} strokeWidth={3} /> Fui
            {attendance.stars > 0 && attendance.value !== 'fui' && <span className={styles.attendStars}>+{attendance.stars}</span>}
          </button>
          <button type="button" className={styles.attendBtn} aria-pressed={attendance.value === 'falte'} onClick={() => attendance.onChange('falte')}>
            Falté
          </button>
          {onSkip && (
            <button type="button" className={styles.attendBtn} onClick={onSkip}>
              No hubo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface WorkCardProps {
  placement: Placement;
  task?: Task;
  date: ISODate;
  courseName?: string;
  courseColor?: string;
  short: boolean;
  running: boolean;
  dragging: boolean;
  /** Hora con que se puede soltar otra tarea encima (no aplica dentro de un traslado). */
  dropMin?: number;
  handle: ReturnType<ReturnType<typeof useDragDrop>['handleProps']>;
  onStart: () => void;
  onComplete: () => void;
}

function WorkCard({ placement, task, date, courseName, courseColor, short, running, dragging, dropMin, handle, onStart, onComplete }: WorkCardProps) {
  const { unit } = placement;
  const openTaskForm = useUI((s) => s.openTaskForm);
  const openTimeLog = useUI((s) => s.openTimeLog);
  if (!task) return null;
  const dur = placement.end - placement.start;
  const urgentLabel =
    task.deadline && task.deadline <= date
      ? 'Entrega hoy'
      : unit.tier === 0
        ? 'Sí o sí hoy'
        : task.deadline === addDays(date, 1)
          ? 'Vence mañana'
          : null;

  return (
    <div
      className={`${styles.work} ${unit.tier === 0 ? styles.urgent : ''} ${running ? styles.running : ''} ${dragging ? styles.lifted : ''}`}
      data-drop={dropMin !== undefined ? 'time' : undefined}
      data-min={dropMin}
    >
      <button type="button" className={styles.handle} aria-label={`Mover "${unit.title}"`} {...handle}>
        <Icon name="grip" size={20} strokeWidth={3.2} />
      </button>
      {short && !placement.travel && <span className={styles.gapTag}>Entre clases</span>}
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="check-hit">
          <input
            type="checkbox"
            className="checkbox"
            aria-label={`Marcar "${unit.title}" como hecha`}
            checked={false}
            onChange={onComplete}
          />
        </span>
        <button type="button" className={styles.workMain} onClick={() => openTaskForm({ taskId: task.id })}>
          <span className={styles.workTitle}>{unit.title}</span>
          <span className={styles.workMeta}>
            {courseName && <GroupTag name={courseName} color={courseColor} />}
            <span className="small muted">
              {unit.subtaskId ? `${unit.taskTitle} · ` : ''}
              {formatDuration(dur)}
              {placement.partial && ' (una parte)'}
            </span>
          </span>
        </button>
      </div>
      <div className="row row--between">
        <div className="pills" style={{ gap: 6 }}>
          {urgentLabel && <span className="chip chip--main">{urgentLabel}</span>}
          <span className={`chip ${DIFF_CHIP[task.difficulty]}`}>{DIFF_LABEL[task.difficulty]}</span>
        </div>
        <div className="row" style={{ gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            className="icon-btn icon-btn--plain"
            aria-label={`Agregar tiempo a "${task.title}"`}
            onClick={() => openTimeLog({ taskId: task.id })}
          >
            <Icon name="clock" size={18} />
          </button>
          <button type="button" className={`btn btn--sm ${running ? 'btn--main' : 'btn--primary'}`} onClick={onStart}>
            <Icon name={running ? 'timer' : 'play'} size={16} />
            {running ? 'En curso' : 'Empezar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DoneCardProps {
  block: DoneBlock;
  courseName?: string;
  courseColor?: string;
  onUndo: () => void;
}

/** Trabajo terminado: se queda en su hora, tachado y apagado. */
function DoneCard({ block, courseName, courseColor, onUndo }: DoneCardProps) {
  const openTaskForm = useUI((s) => s.openTaskForm);
  return (
    <div className={`${styles.work} ${styles.done}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="check-hit">
          <input type="checkbox" className="checkbox" aria-label={`Desmarcar "${block.title}"`} checked onChange={onUndo} />
        </span>
        <button type="button" className={styles.workMain} onClick={() => openTaskForm({ taskId: block.taskId })}>
          <span className={styles.workTitle}>{block.title}</span>
          <span className={styles.workMeta}>
            {courseName && <GroupTag name={courseName} color={courseColor} />}
            <span className="small muted">
              Hecha · {minToHHMM(block.start)}–{minToHHMM(block.end)} · {formatDuration(block.end - block.start)}
              {block.subtaskId ? ` · ${block.taskTitle}` : ''}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

interface TravelCardProps {
  block: TravelBlock;
  dragging: boolean;
  handle: ReturnType<ReturnType<typeof useDragDrop>['handleProps']>;
  children: React.ReactNode;
}

/** Traslado casa ↔ U: tiempo ocupado donde solo van tareas para el transporte. */
function TravelCard({ block, dragging, handle, children }: TravelCardProps) {
  const title = TRAVEL_TITLE[block.leg];
  const range = `${minToHHMM(block.start)}–${minToHHMM(block.end)}`;
  const hasTasks = Array.isArray(children) ? children.length > 0 : !!children;

  const status = block.added ? ' · agregado' : block.moved ? ' · movido' : '';

  return (
    <div className={`${styles.block} ${styles.travel} ${dragging ? styles.lifted : ''}`} data-drop="travel" data-leg={block.leg}>
      <div className={styles.blockHead}>
        <div className="row" style={{ gap: 10, minWidth: 0 }}>
          <span className={styles.travelIcon}>
            <Icon name="bus" size={20} />
          </span>
          <div className="stack" style={{ gap: 0, minWidth: 0 }}>
            <span className={styles.blockTitle}>{title}</span>
            <span className="small">
              {range} · {formatDuration(block.end - block.start)}
              {status}
            </span>
          </div>
        </div>
        <button type="button" className={styles.handle} style={{ position: 'static', flexShrink: 0 }} aria-label={`Mover ${title}`} {...handle}>
          <Icon name="grip" size={20} strokeWidth={3.2} />
        </button>
      </div>
      {hasTasks ? (
        <div className="stack" style={{ gap: 8 }}>
          {children}
        </div>
      ) : (
        <p className={styles.travelHint}>Marca una tarea como “Se puede en el transporte” o arrástrala aquí.</p>
      )}
    </div>
  );
}

interface MoveSheetProps {
  state: MoveState;
  travel: TravelBlock[];
  pin?: TaskPin;
  onClose: () => void;
  onPin: (pin: TaskPin | null) => void;
  onTravel: (patch: TravelOverride | null) => void;
}

/** Mover sin arrastrar: elegir la hora exacta, un traslado, o soltar. */
function MoveSheet({ state, travel, pin, onClose, onPin, onTravel }: MoveSheetProps) {
  const [time, setTime] = useState(minToHHMM(state.kind === 'unit' ? state.start : state.block.start));

  if (state.kind === 'travel') {
    const { block } = state;
    return (
      <TravelSheet
        title={TRAVEL_TITLE[block.leg]}
        legs={[block.leg]}
        initial={{ leg: block.leg, start: minToHHMM(block.start), durationMin: block.end - block.start }}
        onClose={onClose}
        // Si solo cambias la duración, la hora sigue siendo la automática (la ida igual llega a clases).
        onSave={({ start, durationMin }) =>
          onTravel({ start: block.moved || block.added || start !== minToHHMM(block.start) ? start : undefined, durationMin, removed: undefined })
        }
        onReset={!block.added && (block.moved || block.customDuration) ? () => onTravel(null) : undefined}
        onRemove={() => onTravel({ removed: true })}
      />
    );
  }

  return (
    <Sheet title={`Mover “${state.title}”`} onClose={onClose}>
      <div className="stack">
        <div className="field">
          <label htmlFor="mv-time">Hacerla a las</label>
          <input id="mv-time" type="time" className="input" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
        </div>
        <button type="button" className="btn btn--primary" onClick={() => onPin({ at: time })}>
          <Icon name="pin" size={16} /> Fijar a esta hora
        </button>
        {travel.map((t) => (
          <button key={t.leg} type="button" className="btn" onClick={() => onPin({ travel: t.leg })}>
            <Icon name="bus" size={16} /> En la {t.leg === 'ida' ? 'ida' : 'vuelta'} ({minToHHMM(t.start)}–{minToHHMM(t.end)})
          </button>
        ))}
        {pin && (
          <button type="button" className="btn" onClick={() => onPin(null)}>
            Soltar (que la app la ordene)
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** Etiqueta chiquita con el nombre del ramo (o categoría) pintada de su color. */
export function GroupTag({ name, color }: { name: string; color?: string }) {
  const bg = color ?? 'var(--switch-off)';
  return (
    <span className={styles.groupTag} style={{ background: bg, color: color ? inkOn(color) : 'var(--ink)' }}>
      {name}
    </span>
  );
}

const DURATIONS = [30, 45, 60, 90];

interface TravelSheetProps {
  title: string;
  /** Traslados que se pueden elegir (al agregar, los que faltan ese día). */
  legs: TravelLeg[];
  initial: { leg: TravelLeg; start: string; durationMin: number };
  onClose: () => void;
  onSave: (v: { leg: TravelLeg; start: string; durationMin: number }) => void;
  /** Volver a la hora y duración de siempre. */
  onReset?: () => void;
  /** Quitarlo de este día. */
  onRemove?: () => void;
}

/** Agregar un traslado o cambiar su hora y duración ese día. */
function TravelSheet({ title, legs, initial, onClose, onSave, onReset, onRemove }: TravelSheetProps) {
  const [leg, setLeg] = useState(initial.leg);
  const [start, setStart] = useState(initial.start);
  const [duration, setDuration] = useState(initial.durationMin);
  const valid = duration >= 5 && duration <= 240;

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack">
        {legs.length > 1 && (
          <div className="segmented" role="group" aria-label="Traslado">
            {legs.map((l) => (
              <button key={l} type="button" aria-pressed={leg === l} onClick={() => setLeg(l)}>
                {TRAVEL_TITLE[l]}
              </button>
            ))}
          </div>
        )}
        <div className="field">
          <label htmlFor="tv-time">Salgo a las</label>
          <input id="tv-time" type="time" className="input" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </div>
        <div className="field">
          <span className="field-label" id="tv-dur">
            Me demoro
          </span>
          <div className="pills" role="group" aria-labelledby="tv-dur">
            {DURATIONS.map((m) => (
              <button key={m} type="button" className="pill" aria-pressed={duration === m} onClick={() => setDuration(m)}>
                {formatDuration(m)}
              </button>
            ))}
            <label className={styles.customMin}>
              <span className="sr-only">Otros minutos</span>
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={240}
                className="input"
                placeholder="Otro"
                value={DURATIONS.includes(duration) ? '' : duration || ''}
                onChange={(e) => setDuration(Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <span className="small muted">Solo este día. La duración de siempre está en Ajustes › Mi día.</span>
        </div>
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={() => onSave({ leg, start, durationMin: duration })}>
          {onRemove ? 'Guardar' : 'Agregar'}
        </button>
        {onReset && (
          <button type="button" className="btn" onClick={onReset}>
            Volver a lo de siempre
          </button>
        )}
        {onRemove && (
          <button type="button" className="btn" onClick={onRemove}>
            Hoy no viajo
          </button>
        )}
      </div>
    </Sheet>
  );
}
