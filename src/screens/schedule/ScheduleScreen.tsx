import { type FormEvent, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useLookups } from '../../hooks/useDerived';
import { inkOn } from '../../lib/color';
import { WEEKDAYS, hhmmToMin } from '../../lib/time';
import { COURSE_COLORS } from '../../store/defaults';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { BlockKind, WeeklyBlock } from '../../types';

export function ScheduleScreen() {
  const weekly = useStore((s) => s.weekly);
  const openPage = useUI((s) => s.openPage);
  const { course, category, blockColor } = useLookups();
  const [editing, setEditing] = useState<WeeklyBlock | 'new' | null>(null);

  return (
    <div className="screen screen--no-nav">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label="Volver" onClick={() => openPage(null)}>
          <Icon name="back" />
        </button>
        <h1 className="title" style={{ fontSize: 24, flex: 1 }}>
          Horario semanal
        </h1>
      </header>
      <p className="muted small" style={{ margin: 0 }}>
        Tus clases y actividades fijas se repiten cada semana. Si un día no hay clase, márcalo desde la pantalla Hoy.
      </p>

      {WEEKDAYS.map((name, wd) => {
        const blocks = weekly.filter((b) => b.weekday === wd).sort((a, b) => hhmmToMin(a.start) - hhmmToMin(b.start));
        if (blocks.length === 0 && wd >= 5) return null;
        return (
          <section key={wd} className="stack" aria-label={name}>
            <h2 className="section-title">{name}</h2>
            {blocks.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>Libre</p>
            ) : (
              blocks.map((b) => {
                const bg = blockColor(b) ?? (b.kind === 'clase' ? '#DCD6F7' : '#C9EBD8');
                const group = b.kind === 'clase' ? course(b.courseId)?.name : category(b.categoryId)?.name;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className="card row row--between"
                    style={{ border: 'none', background: bg, color: inkOn(bg), minHeight: 52, textAlign: 'left' }}
                    onClick={() => setEditing(b)}
                  >
                    <span className="stack" style={{ gap: 0 }}>
                      <span style={{ fontWeight: 800 }}>{b.title}</span>
                      <span className="small">
                        {b.start}–{b.end}
                        {b.location && ` · ${b.location}`}
                        {group && b.title !== group && ` · ${group}`}
                      </span>
                    </span>
                    <Icon name="edit" size={18} />
                  </button>
                );
              })
            )}
          </section>
        );
      })}

      <button type="button" className="btn btn--primary btn--block" onClick={() => setEditing('new')}>
        <Icon name="plus" size={18} /> Agregar clase o actividad
      </button>

      {editing && <BlockForm block={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BlockForm({ block, onClose }: { block?: WeeklyBlock; onClose: () => void }) {
  const courses = useStore((s) => s.courses);
  const categories = useStore((s) => s.categories);
  const saveCategory = useStore((s) => s.saveCategory);
  const activityTypes = useStore((s) => s.activityTypes);
  const saveBlock = useStore((s) => s.saveBlock);
  const deleteBlock = useStore((s) => s.deleteBlock);

  const [kind, setKind] = useState<BlockKind>(block?.kind ?? 'clase');
  const [courseId, setCourseId] = useState(block?.courseId ?? '');
  const [title, setTitle] = useState(block?.title ?? '');
  const [days, setDays] = useState<number[]>(block ? [block.weekday] : []);
  const [start, setStart] = useState(block?.start ?? '08:20');
  const [end, setEnd] = useState(block?.end ?? '09:30');
  const [location, setLocation] = useState(block?.location ?? '');
  const [activityId, setActivityId] = useState(block?.activityId ?? 'catedra');
  const [categoryId, setCategoryId] = useState(block?.categoryId ?? '');

  const pickCategory = (value: string) => {
    if (value !== '__nueva__') return setCategoryId(value);
    const name = prompt('Nombre de la nueva categoría')?.trim();
    if (!name) return;
    setCategoryId(saveCategory({ name, color: COURSE_COLORS[(categories.length + 6) % COURSE_COLORS.length] }));
  };

  const finalTitle =
    title.trim() ||
    (kind === 'clase' ? courses.find((c) => c.id === courseId)?.name : categories.find((c) => c.id === categoryId)?.name) ||
    '';
  const valid = finalTitle && days.length > 0 && hhmmToMin(end) > hhmmToMin(start);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const base = {
      title: finalTitle,
      kind,
      start,
      end,
      location: location.trim() || undefined,
      courseId: kind === 'clase' ? courseId || undefined : undefined,
      activityId: kind === 'clase' ? activityId : undefined,
      categoryId: kind === 'actividad' ? categoryId || undefined : undefined,
    };
    if (block) {
      saveBlock({ ...base, id: block.id, weekday: days[0] });
      days.slice(1).forEach((weekday) => saveBlock({ ...base, weekday }));
    } else {
      days.forEach((weekday) => saveBlock({ ...base, weekday }));
    }
    onClose();
  };

  const toggleDay = (d: number) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));

  return (
    <Sheet
      title={block ? 'Editar bloque' : 'Nuevo bloque'}
      onClose={onClose}
      footer={
        <>
          {block && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                deleteBlock(block.id);
                onClose();
              }}
            >
              Borrar
            </button>
          )}
          <button type="submit" form="block-form" className="btn btn--primary btn--block" disabled={!valid}>
            Guardar
          </button>
        </>
      }
    >
      <form id="block-form" className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="segmented" role="group" aria-label="Tipo de bloque">
          <button type="button" aria-pressed={kind === 'clase'} onClick={() => setKind('clase')}>
            Clase
          </button>
          <button type="button" aria-pressed={kind === 'actividad'} onClick={() => setKind('actividad')}>
            Otra actividad
          </button>
        </div>
        {kind === 'clase' && (
          <div className="grid-2">
            <div className="field">
              <label htmlFor="bl-course">Ramo</label>
              <select id="bl-course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Sin ramo</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="bl-act">Cuenta como</label>
              <select id="bl-act" className="input" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
                {activityTypes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {kind === 'actividad' && (
          <div className="field">
            <label htmlFor="bl-cat">Categoría</label>
            <select id="bl-cat" className="input" value={categoryId} onChange={(e) => pickCategory(e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__nueva__">+ Nueva categoría…</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="bl-title">Nombre{(kind === 'clase' && courseId) || (kind === 'actividad' && categoryId) ? ' (opcional)' : ''}</label>
          <input
            id="bl-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'clase' ? 'Ej: Cálculo II o Ayudantía' : 'Ej: Ensayo coro'}
          />
        </div>
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }} className="stack">
          <legend className="field-label" style={{ marginBottom: 6 }}>
            Días
          </legend>
          <div className="pills">
            {WEEKDAYS.map((d, i) => (
              <button key={d} type="button" className="pill" aria-pressed={days.includes(i)} onClick={() => toggleDay(i)}>
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="bl-start">Desde</label>
            <input id="bl-start" type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="bl-end">Hasta</label>
            <input id="bl-end" type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="bl-loc">Sala o lugar (opcional)</label>
          <input id="bl-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </form>
    </Sheet>
  );
}
