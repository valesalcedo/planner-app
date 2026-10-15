import type { HHMM, ISODate } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(now = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** 0 = lunes … 6 = domingo. */
export function weekdayOf(date: ISODate): number {
  return (parseISODate(date).getDay() + 6) % 7;
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, -weekdayOf(date));
}

export function hhmmToMin(t: HHMM): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToHHMM(min: number): HHMM {
  const m = Math.max(0, Math.round(min));
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

/** Minutos desde la medianoche local de un timestamp. */
export function minutesOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

/** Timestamp (ms) de una fecha y minuto del día locales. */
export function tsAt(date: ISODate, minuteOfDay: number): number {
  const d = parseISODate(date);
  d.setMinutes(minuteOfDay);
  return d.getTime();
}

export function formatDuration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

export function formatHours(min: number): string {
  return (min / 60).toLocaleString('es-CL', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatLongDate(date: ISODate): string {
  const d = parseISODate(date);
  return `${WEEKDAYS[weekdayOf(date)]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatShortDate(date: ISODate): string {
  const d = parseISODate(date);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
