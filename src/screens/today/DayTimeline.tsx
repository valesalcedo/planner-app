import { Icon } from '../../components/Icon';
import { useLookups } from '../../hooks/useDerived';
import type { DayPlan, Placement } from '../../lib/scheduler';
import { addDays, formatDuration, hhmmToMin, minToHHMM, weekdayOf } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { ISODate, Task } from '../../types';
import styles from './Today.module.css';

interface Props {
  date: ISODate;
  plan: DayPlan;
  doneTasks: Task[];
}

type Row =
  | { type: 'busy'; start: number; end: number; title: string; kind: string; sourceId: string; skipped: boolean }
  | { type: 'work'; start: number; end: number; placement: Placement };

const DIFF_LABEL = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' } as const;
const DIFF_CHIP = { facil: 'chip--mint', media: 'chip--lavender', dificil: 'chip--yellow' } as const;

export function DayTimeline({ date, plan, doneTasks }: Props) {
  const tasks = useStore((s) => s.tasks);
  const weekly = useStore((s) => s.weekly);
  const events = useStore((s) => s.events);
  const skipped = useStore((s) => s.skipped[date]);
  const activeTimer = useStore((s) => s.activeTimer);
  const toggleSkip = useStore((s) => s.toggleSkip);
  const startTimer = useStore((s) => s.startTimer);
  const setTaskDone = useStore((s) => s.setTaskDone);
  const setSubtaskDone = useStore((s) => s.setSubtaskDone);
  const moveTask = useStore((s) => s.moveTask);
  const setTab = useUI((s) => s.setTab);
  const showToast = useUI((s) => s.showToast);
  const { course } = useLookups();

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const allDay = events.filter((e) => e.date === date && !e.start);
  const deadlines = tasks.filter((t) => t.deadline === date && !t.done);

  const skippedBlocks = weekly.filter((b) => b.weekday === weekdayOf(date) && (skipped ?? []).includes(b.id));
  const rows: Row[] = [
    ...plan.busy.map((b) => ({ type: 'busy' as const, start: b.start, end: b.end, title: b.title, kind: b.kind, sourceId: b.sourceId, skipped: false })),
    ...skippedBlocks.map((b) => ({
      type: 'busy' as const,
      start: hhmmToMin(b.start),
      end: hhmmToMin(b.end),
      title: b.title,
      kind: b.kind,
      sourceId: b.id,
      skipped: true,
    })),
    ...plan.placements.map((p) => ({ type: 'work' as const, start: p.start, end: p.end, placement: p })),
  ].sort((a, b) => a.start - b.start || (a.type === 'busy' ? -1 : 1));

  const start = (p: Placement) => {
    startTimer(p.unit.taskId, p.unit.subtaskId);
    setTab('foco');
  };

  const complete = (p: Placement) => {
    if (p.unit.subtaskId) setSubtaskDone(p.unit.taskId, p.unit.subtaskId, true);
    else setTaskDone(p.unit.taskId, true);
  };

  // Una misma tarea puede aparecer varias veces si la overflow la parte; mostramos cada tarea una vez.
  const overflowTasks = [...new Map(plan.overflow.map((u) => [u.taskId, u])).values()];

  return (
    <div className="stack" style={{ gap: 10 }}>
      {(allDay.length > 0 || deadlines.length > 0) && (
        <div className="pills">
          {allDay.map((e) => (
            <span key={e.id} className={`chip ${e.kind === 'evaluacion' ? 'chip--yellow' : 'chip--pink'}`} style={{ fontSize: 13, padding: '6px 10px' }}>
              {e.title}
            </span>
          ))}
          {deadlines.map((t) => (
            <span key={t.id} className="chip chip--pink" style={{ fontSize: 13, padding: '6px 10px' }}>
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
            <li key={row.type === 'busy' ? `b-${row.sourceId}` : `w-${row.placement.unit.key}-${row.start}`} className={styles.timelineRow}>
              <span className={styles.time}>{minToHHMM(row.start)}</span>
              {row.type === 'busy' ? (
                <BusyCard
                  title={row.title}
                  kind={row.kind}
                  range={`${minToHHMM(row.start)}–${minToHHMM(row.end)}`}
                  skipped={row.skipped}
                  onToggle={row.kind === 'evento' ? undefined : () => toggleSkip(date, row.sourceId)}
                />
              ) : (
                <WorkCard
                  placement={row.placement}
                  task={taskById.get(row.placement.unit.taskId)}
                  date={date}
                  courseName={course(taskById.get(row.placement.unit.taskId)?.courseId)?.name}
                  short={plan.slots.find((s) => row.start >= s.start && row.end <= s.end)?.short ?? false}
                  running={
                    activeTimer?.taskId === row.placement.unit.taskId && activeTimer.subtaskId === row.placement.unit.subtaskId
                  }
                  onStart={() => start(row.placement)}
                  onComplete={() => complete(row.placement)}
                />
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
                      moveTask(t.id, addDays(date, 1));
                      showToast('Movida a mañana');
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

      {doneTasks.length > 0 && (
        <details className="card">
          <summary className="section-title" style={{ cursor: 'pointer', minHeight: 28 }}>
            Hechas ({doneTasks.length})
          </summary>
          <ul className={styles.doneList}>
            {doneTasks.map((t) => (
              <li key={t.id}>
                <label className="row">
                  <span className="check-hit">
                    <input type="checkbox" className="checkbox" checked onChange={() => setTaskDone(t.id, false)} />
                  </span>
                  <span className="muted" style={{ textDecoration: 'line-through' }}>
                    {t.title}
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

function BusyCard(props: { title: string; kind: string; range: string; skipped: boolean; onToggle?: () => void }) {
  const cls = props.kind === 'evento' ? styles.eventBlock : props.kind === 'actividad' ? styles.activityBlock : styles.classBlock;
  return (
    <div className={`${styles.block} ${cls} ${props.skipped ? styles.skipped : ''}`}>
      <div className="stack" style={{ gap: 0, minWidth: 0 }}>
        <span className={styles.blockTitle}>{props.title}</span>
        <span className="small">
          {props.kind === 'clase' ? 'Clase' : props.kind === 'actividad' ? 'Actividad' : 'Evento'} · {props.range}
          {props.skipped && ' · no hubo'}
        </span>
      </div>
      {props.onToggle && (
        <button type="button" className="btn btn--sm" style={{ background: 'rgba(255,255,255,.7)' }} onClick={props.onToggle}>
          {props.skipped ? 'Restaurar' : 'No hay'}
        </button>
      )}
    </div>
  );
}

interface WorkCardProps {
  placement: Placement;
  task?: Task;
  date: ISODate;
  courseName?: string;
  short: boolean;
  running: boolean;
  onStart: () => void;
  onComplete: () => void;
}

function WorkCard({ placement, task, date, courseName, short, running, onStart, onComplete }: WorkCardProps) {
  const { unit } = placement;
  const openTaskForm = useUI((s) => s.openTaskForm);
  if (!task) return null;
  const dur = placement.end - placement.start;
  const urgentLabel = task.deadline && task.deadline <= date ? 'Entrega hoy' : unit.tier === 0 ? 'Sí o sí hoy' : unit.tier === 1 ? 'Vence mañana' : null;

  return (
    <div className={`${styles.work} ${unit.tier === 0 ? styles.urgent : ''} ${running ? styles.running : ''}`}>
      {short && <span className={styles.gapTag}>Entre clases</span>}
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
          <span className="small muted">
            {unit.subtaskId ? `${unit.taskTitle} · ` : ''}
            {formatDuration(dur)}
            {placement.partial && ' (una parte)'}
            {courseName && ` · ${courseName}`}
          </span>
        </button>
      </div>
      <div className="row row--between">
        <div className="pills" style={{ gap: 6 }}>
          {urgentLabel && <span className="chip chip--pink">{urgentLabel}</span>}
          <span className={`chip ${DIFF_CHIP[task.difficulty]}`}>{DIFF_LABEL[task.difficulty]}</span>
        </div>
        <button type="button" className={`btn btn--sm ${running ? 'btn--pink' : 'btn--primary'}`} onClick={onStart}>
          <Icon name={running ? 'timer' : 'play'} size={16} />
          {running ? 'En curso' : 'Empezar'}
        </button>
      </div>
    </div>
  );
}
