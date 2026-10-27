import type { ReactNode } from 'react';
import styles from './Ring.module.css';

interface RingProps {
  /** Avance entre 0 y 1. */
  value: number;
  size: number;
  stroke: number;
  color: string;
  track?: string;
  label: string;
  children?: ReactNode;
}

/** Anillo de avance con contenido al centro. */
export function Ring({ value, size, stroke, color, track = 'var(--line)', label, children }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className={styles.ring} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * v} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={styles.arc}
          />
        )}
      </svg>
      <div className={styles.center} aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
