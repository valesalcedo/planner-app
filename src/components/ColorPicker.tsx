import { useState } from 'react';
import { inkOn, normalizeHex } from '../lib/color';
import { COURSE_COLORS } from '../store/defaults';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import styles from './ColorPicker.module.css';

interface Props {
  value: string;
  /** Para qué es el color, por ejemplo "Cálculo II". Se usa en el título y en lectores de pantalla. */
  label: string;
  onChange: (color: string) => void;
}

/** Botón con el color actual. Al tocarlo, abre la paleta y la opción de elegir cualquier color. */
export function ColorPicker({ value, label, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = normalizeHex(value);
  const isCustom = !COURSE_COLORS.includes(current);

  return (
    <>
      <button
        type="button"
        className={styles.swatchBtn}
        style={{ background: current }}
        aria-label={`Color de ${label}`}
        onClick={() => setOpen(true)}
      />
      {open && (
        <Sheet title={`Color de ${label}`} onClose={() => setOpen(false)}>
          <div className="stack" style={{ gap: 16 }}>
            <div className={styles.grid} role="group" aria-label="Colores sugeridos">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.option}
                  style={{ background: c }}
                  aria-label={c}
                  aria-pressed={current === c}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  {current === c && <Icon name="check" size={20} strokeWidth={3} />}
                </button>
              ))}
            </div>
            <label className={styles.custom}>
              <span className={styles.customPreview} style={{ background: current, color: inkOn(current) }}>
                {isCustom && <Icon name="check" size={18} strokeWidth={3} />}
              </span>
              <span className="stack" style={{ gap: 0, flex: 1 }}>
                <span style={{ fontWeight: 800 }}>Elegir otro color</span>
                <span className="small muted">{isCustom ? current : 'Cualquier tono que quieras'}</span>
              </span>
              <Icon name="edit" size={18} />
              <input
                type="color"
                className={styles.native}
                value={current.toLowerCase()}
                onChange={(e) => onChange(normalizeHex(e.target.value))}
              />
            </label>
          </div>
        </Sheet>
      )}
    </>
  );
}
