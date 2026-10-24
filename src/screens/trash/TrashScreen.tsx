import { useMemo } from 'react';
import { Icon } from '../../components/Icon';
import { daysLeft, lostTasks } from '../../lib/trash';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

export function TrashScreen() {
  const tasks = useStore((s) => s.tasks);
  const trash = useStore((s) => s.trash);
  const entries = useStore((s) => s.entries);
  const stars = useStore((s) => s.stars);
  const restoreTask = useStore((s) => s.restoreTask);
  const purgeTask = useStore((s) => s.purgeTask);
  const recoverLostTask = useStore((s) => s.recoverLostTask);
  const openPage = useUI((s) => s.openPage);
  const showToast = useUI((s) => s.showToast);

  const lost = useMemo(() => lostTasks(tasks, trash, entries, stars), [tasks, trash, entries, stars]);
  const minutesOf = (taskId: string) =>
    entries.filter((e) => e.taskId === taskId).reduce((sum, e) => sum + Math.round((e.end - e.start) / 60000), 0);

  return (
    <div className="screen screen--no-nav">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label="Volver" onClick={() => openPage('ajustes')}>
          <Icon name="back" />
        </button>
        <h1 className="title" style={{ fontSize: 24, flex: 1 }}>
          Papelera
        </h1>
      </header>

      <section className="card card--lg stack" aria-labelledby="trash-title">
        <h2 id="trash-title" className="section-title">
          Borradas
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          Quedan aquí 30 días. Al recuperarlas vuelven con sus subtareas, su avance y su bono si estaban terminadas. El tiempo y las estrellas de foco nunca se pierden.
        </p>
        {trash.length === 0 && <p className="small muted" style={{ margin: 0 }}>No hay nada en la papelera.</p>}
        {trash.map((item) => {
          const min = minutesOf(item.task.id);
          return (
            <div key={item.task.id} className="row row--between" style={{ gap: 8 }}>
              <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.task.title}</span>
                <span className="small muted">
                  {min > 0 ? `${fmtMin(min)} registrados · ` : ''}se borra en {daysLeft(item)} {daysLeft(item) === 1 ? 'día' : 'días'}
                </span>
              </span>
              <button
                type="button"
                className="btn btn--main btn--sm"
                onClick={() => {
                  restoreTask(item.task.id);
                  showToast(`Recuperaste "${item.task.title}"`);
                }}
              >
                Recuperar
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--plain"
                aria-label={`Borrar para siempre: ${item.task.title}`}
                onClick={() => confirm(`¿Borrar "${item.task.title}" para siempre? Su tiempo y estrellas de foco se mantienen.`) && purgeTask(item.task.id)}
              >
                <Icon name="trash" size={18} />
              </button>
            </div>
          );
        })}
      </section>

      {lost.length > 0 && (
        <section className="card card--lg stack" aria-labelledby="lost-title">
          <h2 id="lost-title" className="section-title">
            Borradas antes de la papelera
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            Tienen tiempo registrado, así que puedo volver a crearlas con ese tiempo. Las subtareas y el avance no se guardaron: revísalas al recuperarlas.
          </p>
          {lost.map((l) => (
            <div key={l.taskId} className="row row--between" style={{ gap: 8 }}>
              <span className="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title ?? 'Sin nombre'}</span>
                <span className="small muted">
                  {fmtMin(l.minutes)} · {l.stars} ⭐ de foco · último registro {fmtDate(l.lastAt)}
                </span>
              </span>
              <button
                type="button"
                className="btn btn--main btn--sm"
                onClick={() => {
                  recoverLostTask(l.taskId);
                  showToast(`Recuperaste "${l.title ?? 'la tarea'}"`);
                }}
              >
                Recuperar
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
