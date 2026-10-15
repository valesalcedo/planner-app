import { type FormEvent, useState } from 'react';
import { Sheet } from '../../components/Sheet';
import { useStore } from '../../store/useStore';
import type { CalendarEvent, EventKind, ISODate } from '../../types';

const KINDS: { id: EventKind; label: string }[] = [
  { id: 'evaluacion', label: 'Evaluación' },
  { id: 'entrega', label: 'Entrega' },
  { id: 'evento', label: 'Evento' },
];

interface Props {
  event?: CalendarEvent;
  date: ISODate;
  onClose: () => void;
}

export function EventForm({ event, date, onClose }: Props) {
  const courses = useStore((s) => s.courses);
  const categories = useStore((s) => s.categories);
  const saveEvent = useStore((s) => s.saveEvent);
  const deleteEvent = useStore((s) => s.deleteEvent);

  const [title, setTitle] = useState(event?.title ?? '');
  const [kind, setKind] = useState<EventKind>(event?.kind ?? 'evaluacion');
  const [day, setDay] = useState(event?.date ?? date);
  const [start, setStart] = useState(event?.start ?? '');
  const [end, setEnd] = useState(event?.end ?? '');
  const [courseId, setCourseId] = useState(event?.courseId ?? '');
  const [categoryId, setCategoryId] = useState(event?.categoryId ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    saveEvent({
      ...(event ? { id: event.id } : {}),
      title: title.trim(),
      kind,
      date: day,
      start: start || undefined,
      end: start && end ? end : undefined,
      courseId: courseId || undefined,
      categoryId: kind === 'evento' && categoryId ? categoryId : undefined,
    });
    onClose();
  };

  return (
    <Sheet
      title={event ? 'Editar evento' : 'Nuevo evento'}
      onClose={onClose}
      footer={
        <>
          {event && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                deleteEvent(event.id);
                onClose();
              }}
            >
              Borrar
            </button>
          )}
          <button type="submit" form="event-form" className="btn btn--primary btn--block" disabled={!title.trim()}>
            Guardar
          </button>
        </>
      }
    >
      <form id="event-form" className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="ev-title">Nombre</label>
          <input id="ev-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Interrogación 2" required />
        </div>
        <div className="field">
          <span className="field-label">Tipo</span>
          <div className="segmented" role="group" aria-label="Tipo">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="ev-date">Fecha</label>
          <input id="ev-date" type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} required />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ev-start">Desde (opcional)</label>
            <input id="ev-start" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ev-end">Hasta</label>
            <input id="ev-end" type="time" className="input" value={end} disabled={!start} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <p className="small muted" style={{ margin: '-8px 0 0' }}>
          Si le pones hora, ese tiempo queda ocupado al ordenar tu día. Las evaluaciones con hora suman a tu carga académica.
        </p>
        {kind === 'evento' && categories.length > 0 && (
          <div className="field">
            <label htmlFor="ev-cat">Categoría</label>
            <select id="ev-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="ev-course">Ramo</label>
          <select id="ev-course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Sin ramo</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Sheet>
  );
}
