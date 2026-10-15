import { type FormEvent, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { uid } from '../../lib/id';
import { today } from '../../lib/time';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { Difficulty, Subtask } from '../../types';
import styles from './TaskForm.module.css';

const PRESETS = [15, 30, 45, 60, 90, 120];
const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: 'facil', label: 'Fácil' },
  { id: 'media', label: 'Media' },
  { id: 'dificil', label: 'Difícil' },
];

export function TaskForm() {
  const formState = useUI((s) => s.taskForm);
  const close = useUI((s) => s.closeTaskForm);
  const showToast = useUI((s) => s.showToast);
  const existing = useStore((s) => s.tasks.find((t) => t.id === formState?.taskId));
  const courses = useStore((s) => s.courses);
  const activityTypes = useStore((s) => s.activityTypes);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const openPage = useUI((s) => s.openPage);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(existing?.date ?? formState?.date ?? today());
  const [deadline, setDeadline] = useState(existing?.deadline ?? '');
  const [courseId, setCourseId] = useState(existing?.courseId ?? '');
  const [activityId, setActivityId] = useState(existing?.activityId ?? 'tareas');
  const [estimate, setEstimate] = useState(existing?.estimateMin ?? 30);
  const [difficulty, setDifficulty] = useState<Difficulty>(existing?.difficulty ?? 'media');
  const [mustToday, setMustToday] = useState(existing?.mustToday ?? false);
  const [subtasks, setSubtasks] = useState<Subtask[]>(existing?.subtasks ?? []);

  const subTotal = subtasks.reduce((s, st) => s + (st.estimateMin || 0), 0);
  const finalEstimate = subtasks.length > 0 ? subTotal : estimate;

  const updateSub = (id: string, patch: Partial<Subtask>) =>
    setSubtasks((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = subtasks.filter((s) => s.title.trim()).map((s) => ({ ...s, title: s.title.trim(), estimateMin: Math.max(5, s.estimateMin || 0) }));
    const data = {
      title: title.trim(),
      date,
      deadline: deadline || undefined,
      courseId: courseId || undefined,
      activityId,
      estimateMin: clean.length > 0 ? clean.reduce((s, x) => s + x.estimateMin, 0) : Math.max(5, estimate),
      difficulty,
      mustToday,
      subtasks: clean,
    };
    if (!data.title) return;
    if (existing) updateTask(existing.id, data);
    else addTask(data);
    showToast(existing ? 'Tarea actualizada' : 'Tarea agregada a tu día');
    close();
  };

  return (
    <Sheet
      title={existing ? 'Editar tarea' : 'Nueva tarea'}
      onClose={close}
      footer={
        <>
          {existing && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                if (confirm(`¿Borrar "${existing.title}"? Se quita el bono de estrellas por terminarla; el tiempo cronometrado se mantiene en tus estadísticas.`)) {
                  deleteTask(existing.id);
                  close();
                }
              }}
            >
              Borrar
            </button>
          )}
          <button type="submit" form="task-form" className="btn btn--primary btn--block" disabled={!title.trim()}>
            {existing ? 'Guardar cambios' : 'Guardar y ordenar mi día'}
          </button>
        </>
      }
    >
      <form id="task-form" className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="tf-title">Nombre</label>
          <input id="tf-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Informe de laboratorio" autoFocus={!existing} required />
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="tf-date">Hacer el día</label>
            <input id="tf-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="tf-deadline">Fecha de entrega</label>
            <input id="tf-deadline" type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="tf-course">Ramo</label>
            <select id="tf-course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Sin ramo</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tf-activity">Tipo de actividad</label>
            <select id="tf-activity" className="input" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              {activityTypes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {courses.length === 0 && (
          <button type="button" className={styles.link} onClick={() => { close(); openPage('ajustes'); }}>
            Agrega tus ramos en Ajustes para ver tu carga académica por curso
          </button>
        )}

        <div className="field">
          <span className="field-label">Tiempo estimado</span>
          {subtasks.length > 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              {finalEstimate} min en total, la suma de las subtareas.
            </p>
          ) : (
            <div className="pills">
              {PRESETS.map((m) => (
                <button key={m} type="button" className="pill" aria-pressed={estimate === m} onClick={() => setEstimate(m)}>
                  {m < 60 ? `${m} min` : `${m / 60} h`.replace('.5 h', ' h 30')}
                </button>
              ))}
              <label className={styles.custom}>
                <span className="sr-only">Minutos personalizados</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={5}
                  step={5}
                  className="input"
                  value={PRESETS.includes(estimate) ? '' : estimate}
                  placeholder="Otro"
                  onChange={(e) => setEstimate(Number(e.target.value) || 0)}
                />
              </label>
            </div>
          )}
        </div>

        <div className="field">
          <span className="field-label">Dificultad</span>
          <div className="segmented" role="group" aria-label="Dificultad">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} type="button" aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="card switch-row">
          <span className="stack" style={{ gap: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>Sí o sí ese día</span>
            <span className="small muted">Se agenda temprano y no se posterga</span>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={mustToday} onChange={(e) => setMustToday(e.target.checked)} />
        </label>

        <fieldset className={styles.subs}>
          <legend className="field-label">Subtareas</legend>
          <p className="small muted" style={{ margin: 0 }}>
            Se pueden avanzar en momentos distintos del día.
          </p>
          {subtasks.map((s, i) => (
            <div key={s.id} className={styles.subRow}>
              <input
                className="input"
                aria-label={`Subtarea ${i + 1}`}
                value={s.title}
                placeholder={`Subtarea ${i + 1}`}
                onChange={(e) => updateSub(s.id, { title: e.target.value })}
              />
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={5}
                step={5}
                aria-label={`Minutos de la subtarea ${i + 1}`}
                value={s.estimateMin || ''}
                onChange={(e) => updateSub(s.id, { estimateMin: Number(e.target.value) || 0 })}
              />
              <button
                type="button"
                className="icon-btn icon-btn--plain"
                aria-label={`Quitar subtarea ${i + 1}`}
                onClick={() => setSubtasks((list) => list.filter((x) => x.id !== s.id))}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn--ghost"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setSubtasks((list) => [...list, { id: uid(), title: '', estimateMin: 30, done: false }])}
          >
            <Icon name="plus" size={18} /> Agregar subtarea
          </button>
        </fieldset>
      </form>
    </Sheet>
  );
}
