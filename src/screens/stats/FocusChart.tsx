import { useState } from 'react';
import { WEEKDAYS, WEEKDAYS_SHORT, formatHours, formatShortDate } from '../../lib/time';
import type { ISODate } from '../../types';
import styles from './Stats.module.css';

interface Props {
  days: ISODate[];
  /** Minutos por día. */
  values: number[];
}

const W = 320;
const H = 150;
const TOP = 16;
const BOTTOM = 22;
const BAR_W = 26;

/** Barras de una sola serie: horas de foco por día. Toca una barra para ver el valor. */
export function FocusChart({ days, values }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const maxH = Math.max(1, Math.ceil(Math.max(...values) / 60));
  const plotH = H - TOP - BOTTOM;
  const step = W / 7;
  const y = (min: number) => TOP + plotH - (min / 60 / maxH) * plotH;

  return (
    <div className={styles.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Horas de foco por día de la semana">
        {[0, maxH / 2, maxH].map((h) => (
          <g key={h}>
            <line x1={0} x2={W} y1={y(h * 60)} y2={y(h * 60)} stroke="var(--line)" strokeWidth={1} />
            {h > 0 && (
              <text x={W} y={y(h * 60) - 4} textAnchor="end" className={styles.axis}>
                {formatHours(h * 60)} h
              </text>
            )}
          </g>
        ))}
        {values.map((v, i) => {
          const cx = step * i + step / 2;
          const top = y(v);
          const hgt = TOP + plotH - top;
          return (
            <g key={days[i]}>
              {v > 0 && (
                <path
                  d={roundedTop(cx - BAR_W / 2, top, BAR_W, hgt, Math.min(4, hgt))}
                  fill="var(--primary-strong)"
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              <text x={cx} y={H - 6} textAnchor="middle" className={styles.axis}>
                {WEEKDAYS_SHORT[i]}
              </text>
              <rect
                x={step * i}
                y={0}
                width={step}
                height={H}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${WEEKDAYS[i]}: ${formatHours(v)} horas`}
                onClick={() => setActive(active === i ? null : i)}
                onFocus={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      <p className={styles.readout} aria-live="polite">
        {active !== null
          ? `${WEEKDAYS[active]} ${formatShortDate(days[active])}: ${formatHours(values[active])} h`
          : 'Toca un día para ver sus horas'}
      </p>
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
