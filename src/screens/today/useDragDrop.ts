/**
 * Arrastrar y soltar en "Mi día", pensado para el dedo en el iPhone.
 *
 * Se arrastra desde un asa (el ícono de puntitos), así el resto de la tarjeta sigue
 * haciendo scroll normal. Un toque sin mover el asa abre la hoja "Mover" (para elegir
 * la hora exacta sin arrastrar). Los lugares donde se puede soltar llevan `data-drop`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TravelLeg } from '../../types';

export type DragPayload =
  | { kind: 'unit'; key: string; title: string }
  | { kind: 'travel'; leg: TravelLeg; title: string };

export type DropTarget =
  | { kind: 'time'; min: number }
  | { kind: 'travel'; leg: TravelLeg }
  | { kind: 'busy'; title: string };

export interface DragState {
  payload: DragPayload;
  x: number;
  y: number;
}

const MOVE_THRESHOLD = 6;
const EDGE = 90;
const OVER_CLASS = 'drop-over';

function targetAt(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y);
  return (el?.closest('[data-drop]') as HTMLElement | null) ?? null;
}

function readTarget(el: HTMLElement): DropTarget | null {
  const kind = el.dataset.drop;
  if (kind === 'time') return { kind: 'time', min: Number(el.dataset.min) };
  if (kind === 'travel') return { kind: 'travel', leg: el.dataset.leg as TravelLeg };
  if (kind === 'busy') return { kind: 'busy', title: el.dataset.title ?? '' };
  return null;
}

export function useDragDrop(onDrop: (p: DragPayload, t: DropTarget) => void, onTap: (p: DragPayload) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const live = useRef<{ payload: DragPayload; x: number; y: number; startX: number; startY: number; active: boolean } | null>(null);
  const over = useRef<HTMLElement | null>(null);
  const frame = useRef<number | undefined>(undefined);

  const setOver = (el: HTMLElement | null) => {
    if (over.current === el) return;
    over.current?.classList.remove(OVER_CLASS);
    el?.classList.add(OVER_CLASS);
    over.current = el;
  };

  // Mientras arrastras cerca del borde, la pantalla se desplaza sola.
  const tick = useCallback(() => {
    const d = live.current;
    if (!d?.active) return;
    const h = window.innerHeight;
    const speed = d.y < EDGE ? -Math.ceil((EDGE - d.y) / 6) : d.y > h - EDGE ? Math.ceil((d.y - (h - EDGE)) / 6) : 0;
    if (speed !== 0) {
      window.scrollBy(0, speed);
      setOver(targetAt(d.x, d.y));
    }
    frame.current = requestAnimationFrame(tick);
  }, []);

  const end = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setOver(null);
    live.current = null;
    setDrag(null);
    document.body.classList.remove('dragging');
  }, []);

  useEffect(() => end, [end]);

  const handleProps = (payload: DragPayload) => ({
    'data-drag-handle': true,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      live.current = { payload, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = live.current;
      if (!d) return;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.active) {
        if (Math.hypot(d.x - d.startX, d.y - d.startY) < MOVE_THRESHOLD) return;
        d.active = true;
        document.body.classList.add('dragging');
        frame.current = requestAnimationFrame(tick);
      }
      setOver(targetAt(d.x, d.y));
      setDrag({ payload: d.payload, x: d.x, y: d.y });
    },
    onPointerUp: () => {
      const d = live.current;
      const target = over.current ? readTarget(over.current) : null;
      end();
      if (!d) return;
      if (!d.active) onTap(d.payload);
      else if (target) onDrop(d.payload, target);
    },
    onPointerCancel: end,
  });

  return { drag, handleProps };
}
