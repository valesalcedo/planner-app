import { type ChangeEvent, useState } from 'react';
import { ColorPicker } from '../../components/ColorPicker';
import { Icon } from '../../components/Icon';
import { toISODate } from '../../lib/time';
import { COURSE_COLORS } from '../../store/defaults';
import { snapshot, useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { AppData } from '../../types';
import styles from './Settings.module.css';
import { ThemePicker } from './ThemePicker';

export function SettingsScreen() {
  const courses = useStore((s) => s.courses);
  const categories = useStore((s) => s.categories);
  const saveCategory = useStore((s) => s.saveCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const activityTypes = useStore((s) => s.activityTypes);
  const settings = useStore((s) => s.settings);
  const saveCourse = useStore((s) => s.saveCourse);
  const deleteCourse = useStore((s) => s.deleteCourse);
  const saveActivityType = useStore((s) => s.saveActivityType);
  const updateSettings = useStore((s) => s.updateSettings);
  const importData = useStore((s) => s.importData);
  const resetData = useStore((s) => s.resetData);
  const openPage = useUI((s) => s.openPage);
  const showToast = useUI((s) => s.showToast);

  const [newCourse, setNewCourse] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const addCourse = () => {
    if (!newCourse.trim()) return;
    saveCourse({ name: newCourse.trim(), color: COURSE_COLORS[courses.length % COURSE_COLORS.length] });
    setNewCourse('');
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-respaldo-${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as AppData;
      if (data.version !== 1 || !Array.isArray(data.tasks)) throw new Error('formato');
      if (confirm('Esto reemplaza todos tus datos actuales por los del respaldo. ¿Continuar?')) {
        importData(data);
        showToast('Respaldo importado');
      }
    } catch {
      showToast('Ese archivo no es un respaldo válido');
    }
  };

  return (
    <div className="screen screen--no-nav">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label="Volver" onClick={() => openPage(null)}>
          <Icon name="back" />
        </button>
        <h1 className="title" style={{ fontSize: 24, flex: 1 }}>
          Ajustes
        </h1>
      </header>

      <ThemePicker />

      <section className="card card--lg stack" aria-labelledby="courses-title">
        <h2 id="courses-title" className="section-title">
          Ramos
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          Se usan para separar tu carga académica por curso. Toca el cuadrito para cambiar su color: las clases del ramo se pintan con él.
        </p>
        {courses.map((c) => (
          <div key={c.id} className={styles.courseRow}>
            <ColorPicker value={c.color} label={c.name} onChange={(color) => saveCourse({ ...c, color })} />
            <input
              className="input"
              aria-label="Nombre del ramo"
              defaultValue={c.name}
              onBlur={(e) => e.target.value.trim() && saveCourse({ ...c, name: e.target.value.trim() })}
            />
            <button
              type="button"
              className="icon-btn icon-btn--plain"
              aria-label={`Borrar ${c.name}`}
              onClick={() => confirm(`¿Borrar el ramo "${c.name}"?`) && deleteCourse(c.id)}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            addCourse();
          }}
        >
          <input className="input" placeholder="Nuevo ramo" aria-label="Nuevo ramo" value={newCourse} onChange={(e) => setNewCourse(e.target.value)} />
          <button type="submit" className="btn btn--main" disabled={!newCourse.trim()}>
            Agregar
          </button>
        </form>
      </section>

      <section className="card card--lg stack" aria-labelledby="cats-title">
        <h2 id="cats-title" className="section-title">
          Categorías de actividades
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          Para lo que no es clase: coro, salidas, deporte… Cada categoría tiene su color en el horario y en tu día.
        </p>
        {categories.map((c) => (
          <div key={c.id} className={styles.courseRow}>
            <ColorPicker value={c.color} label={c.name} onChange={(color) => saveCategory({ ...c, color })} />
            <input
              className="input"
              aria-label="Nombre de la categoría"
              defaultValue={c.name}
              onBlur={(e) => e.target.value.trim() && saveCategory({ ...c, name: e.target.value.trim() })}
            />
            <button
              type="button"
              className="icon-btn icon-btn--plain"
              aria-label={`Borrar ${c.name}`}
              onClick={() => confirm(`¿Borrar la categoría "${c.name}"? Las actividades quedan sin categoría.`) && deleteCategory(c.id)}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (!newCategory.trim()) return;
            saveCategory({ name: newCategory.trim(), color: COURSE_COLORS[(categories.length + 6) % COURSE_COLORS.length] });
            setNewCategory('');
          }}
        >
          <input className="input" placeholder="Nueva categoría" aria-label="Nueva categoría" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
          <button type="submit" className="btn btn--main" disabled={!newCategory.trim()}>
            Agregar
          </button>
        </form>
      </section>

      <button type="button" className="card row row--between" style={{ border: 'none', minHeight: 56, textAlign: 'left' }} onClick={() => openPage('horario')}>
        <span className="stack" style={{ gap: 0 }}>
          <span style={{ fontWeight: 800 }}>Horario semanal</span>
          <span className="small muted">Clases y actividades fijas</span>
        </span>
        <Icon name="next" />
      </button>

      <section className="card card--lg stack" aria-labelledby="types-title">
        <h2 id="types-title" className="section-title">
          Tipos de actividad
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          Ajústalos para que calcen con las categorías de tu encuesta de carga académica.
        </p>
        {activityTypes.map((a) => (
          <input key={a.id} className="input" aria-label="Tipo de actividad" defaultValue={a.name} onBlur={(e) => e.target.value.trim() && saveActivityType(e.target.value.trim(), a.id)} />
        ))}
        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (newActivity.trim()) saveActivityType(newActivity.trim());
            setNewActivity('');
          }}
        >
          <input className="input" placeholder="Nuevo tipo" aria-label="Nuevo tipo de actividad" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} />
          <button type="submit" className="btn btn--main" disabled={!newActivity.trim()}>
            Agregar
          </button>
        </form>
      </section>

      <section className="card card--lg stack" aria-labelledby="day-title">
        <h2 id="day-title" className="section-title">
          Mi día
        </h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="st-start">Empiezo a las</label>
            <input id="st-start" type="time" className="input" value={settings.dayStart} onChange={(e) => e.target.value && updateSettings({ dayStart: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="st-end">Termino a las</label>
            <input id="st-end" type="time" className="input" value={settings.dayEnd} onChange={(e) => e.target.value && updateSettings({ dayEnd: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-buffer">Respiro entre tareas (min)</label>
          <input id="st-buffer" type="number" min={0} max={30} inputMode="numeric" className="input" value={settings.bufferMin} onChange={(e) => updateSettings({ bufferMin: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
      </section>

      <section className="card card--lg stack" aria-labelledby="stars-title">
        <h2 id="stars-title" className="section-title">
          Estrellas
        </h2>
        <div className="grid-2">
          <NumberField id="st-ppm" label="Por minuto" value={settings.starsPerMinute} onChange={(v) => updateSettings({ starsPerMinute: v })} />
          <NumberField id="st-streak" label="Días para racha" value={settings.streakDays} onChange={(v) => updateSettings({ streakDays: Math.max(1, Math.round(v)) })} />
          <NumberField id="st-easy" label="Bono tarea fácil" value={settings.bonus.facil} onChange={(v) => updateSettings({ bonus: { ...settings.bonus, facil: v } })} />
          <NumberField id="st-mid" label="Bono tarea media" value={settings.bonus.media} onChange={(v) => updateSettings({ bonus: { ...settings.bonus, media: v } })} />
          <NumberField id="st-hard" label="Bono tarea difícil" value={settings.bonus.dificil} onChange={(v) => updateSettings({ bonus: { ...settings.bonus, dificil: v } })} />
          <NumberField id="st-mult" label="Multiplicador racha" step={0.1} value={settings.streakMultiplier} onChange={(v) => updateSettings({ streakMultiplier: v })} />
          <NumberField id="st-class" label="Por ir a clases" value={settings.starsPerClass} onChange={(v) => updateSettings({ starsPerClass: Math.round(v) })} />
        </div>
      </section>

      <section className="card card--lg stack" aria-labelledby="backup-title">
        <h2 id="backup-title" className="section-title">
          Respaldo
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          Tus datos viven solo en este iPhone. Descarga un respaldo de vez en cuando por si borras los datos de Safari o cambias de teléfono.
        </p>
        <div className="grid-2">
          <button type="button" className="btn btn--accent" onClick={exportBackup}>
            Descargar
          </button>
          <label className="btn" style={{ border: '2px solid var(--accent)' }}>
            Importar
            <input type="file" accept="application/json,.json" className="sr-only" onChange={importBackup} />
          </label>
        </div>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            if (confirm('¿Borrar todos los datos? No se puede deshacer.') && confirm('¿Segura? Descarga un respaldo antes si lo necesitas.')) {
              resetData();
              openPage(null);
            }
          }}
        >
          Borrar todo
        </button>
      </section>
    </div>
  );
}

function NumberField(props: { id: string; label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="number"
        inputMode="decimal"
        min={0}
        step={props.step ?? 1}
        className="input"
        value={props.value}
        onChange={(e) => props.onChange(Math.max(0, Number(e.target.value) || 0))}
      />
    </div>
  );
}
