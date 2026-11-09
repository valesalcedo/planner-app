import { useMemo, useState } from 'react';
import { MONTHS, WEEKDAYS_SHORT, addDays, formatLongDate, parseISODate, startOfWeek, toISODate } from '../lib/time';
import type { ISODate } from '../types';
import { Icon } from './Icon';
import styles from './MonthPicker.module.css';
import { Sheet } from './Sheet';

interface Props {
  title: string;
  /** Día elegido ahora (se marca y define el mes que se abre). */
  value: ISODate;
  todayDate: ISODate;
  /** Días con algo (tareas o tiempo registrado): llevan un puntito. */
  marked?: Set<ISODate>;
  /** Marca la semana completa del día elegido (para elegir semanas). */
  weekMode?: boolean;
  /** Último día que se puede elegir. */
  max?: ISODate;
  onPick: (date: ISODate) => void;
  onClose: () => void;
}

/** Hoja con un calendario de mes para saltar directo a un día (o a su semana). */
export function MonthPicker({ title, value, todayDate, marked, weekMode, max, onPick, onClose }: Props) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const first = parseISODate(`${month}-01`);
  const gridStart = startOfWeek(`${month}-01`);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const selWeek = startOfWeek(value);

  const shift = (delta: number) => setMonth(toISODate(new Date(first.getFullYear(), first.getMonth() + delta, 1)).slice(0, 7));
  const label = `${MONTHS[first.getMonth()]} ${first.getFullYear()}`;

  return (
    <Sheet title={title} onClose={onClose}>
      <div className="stack">
        <div className="row row--between">
          <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => shift(-1)}>
            <Icon name="back" />
          </button>
          <span className={styles.month}>{label}</span>
          <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => shift(1)}>
            <Icon name="next" />
          </button>
        </div>
        <div className={styles.weekHead} aria-hidden="true">
          {WEEKDAYS_SHORT.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className={styles.grid}>
          {days.map((d) => {
            const selected = weekMode ? startOfWeek(d) === selWeek : d === value;
            return (
              <button
                key={d}
                type="button"
                className={styles.day}
                data-out={!d.startsWith(month) || undefined}
                data-today={d === todayDate || undefined}
                aria-pressed={selected}
                aria-label={formatLongDate(d)}
                disabled={!!max && d > max}
                onClick={() => onPick(d)}
              >
                {parseISODate(d).getDate()}
                <span className={styles.dot} data-on={marked?.has(d) || undefined} />
              </button>
            );
          })}
        </div>
        {marked && (
          <span className="row small muted" style={{ gap: 6, fontWeight: 700 }}>
            <span className={styles.dot} data-on aria-hidden="true" /> Días con tareas o tiempo registrado
          </span>
        )}
        <button type="button" className="btn" onClick={() => onPick(todayDate)}>
          {weekMode ? 'Esta semana' : 'Hoy'}
        </button>
      </div>
    </Sheet>
  );
}
