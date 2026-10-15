/** Fecha local en formato YYYY-MM-DD. */
export type ISODate = string;
/** Hora local en formato HH:MM (24 h). */
export type HHMM = string;

export type Difficulty = 'facil' | 'media' | 'dificil';

export interface Course {
  id: string;
  name: string;
  /** Color en hex (#RRGGBB). Puede ser uno de la paleta o uno elegido a mano. */
  color: string;
}

/** Categoría para actividades que no son clases (coro, salidas sociales, etc.). */
export interface Category {
  id: string;
  name: string;
  color: string;
}

/** Tipo de actividad para la encuesta de carga académica (cátedra, estudio, etc.). */
export interface ActivityType {
  id: string;
  name: string;
}

export interface Subtask {
  id: string;
  title: string;
  estimateMin: number;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  /** Día en que planeas hacerla. Si no la terminas, sigue apareciendo los días siguientes. */
  date: ISODate;
  deadline?: ISODate;
  /** Tiene que hacerse sí o sí el día planificado: se agenda temprano y no se posterga. */
  mustToday: boolean;
  difficulty: Difficulty;
  estimateMin: number;
  courseId?: string;
  activityId: string;
  subtasks: Subtask[];
  done: boolean;
  doneAt?: number;
  createdAt: number;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  subtaskId?: string;
  /** Copiados de la tarea al registrar, para que las estadísticas no cambien si editas o borras la tarea. */
  courseId?: string;
  activityId: string;
  start: number;
  end: number;
}

export interface ActiveTimer {
  taskId: string;
  subtaskId?: string;
  startedAt: number;
}

export type BlockKind = 'clase' | 'actividad';

/** Bloque fijo del horario semanal (clases y otras actividades recurrentes). */
export interface WeeklyBlock {
  id: string;
  title: string;
  kind: BlockKind;
  /** 0 = lunes … 6 = domingo. */
  weekday: number;
  start: HHMM;
  end: HHMM;
  location?: string;
  courseId?: string;
  /** Tipo de actividad con que cuenta en la carga académica (solo clases). */
  activityId?: string;
  /** Categoría de la actividad (solo bloques que no son clases). */
  categoryId?: string;
}

/** Asistencia a una clase un día puntual. "No hubo clase" se guarda aparte en `skipped`. */
export type Attendance = 'fui' | 'falte';

export type EventKind = 'evaluacion' | 'entrega' | 'evento';

export interface CalendarEvent {
  id: string;
  title: string;
  date: ISODate;
  start?: HHMM;
  end?: HHMM;
  kind: EventKind;
  courseId?: string;
  /** Categoría (solo eventos que no son de un ramo). */
  categoryId?: string;
}

export interface Reward {
  id: string;
  name: string;
  price: number;
}

export type StarKind = 'foco' | 'tarea' | 'clase' | 'canje' | 'ajuste';

export interface StarTx {
  id: string;
  amount: number;
  reason: string;
  at: number;
  /** De dónde vienen. Los movimientos antiguos no lo tienen. */
  kind?: StarKind;
  /** Id de la tarea, o "fecha:bloque" de la clase, para poder deshacer exactamente lo que se dio. */
  ref?: string;
}

export interface Settings {
  dayStart: HHMM;
  dayEnd: HHMM;
  /** Minutos de respiro entre bloques al ordenar el día. */
  bufferMin: number;
  starsPerMinute: number;
  bonus: Record<Difficulty, number>;
  /** Días de racha necesarios para activar el multiplicador. */
  streakDays: number;
  streakMultiplier: number;
  /** Estrellas por marcar que fuiste a una clase. */
  starsPerClass: number;
}

export interface AppData {
  version: 1;
  courses: Course[];
  categories: Category[];
  activityTypes: ActivityType[];
  tasks: Task[];
  entries: TimeEntry[];
  activeTimer: ActiveTimer | null;
  weekly: WeeklyBlock[];
  /** Clases que no ocurren un día puntual: fecha → ids de bloques. */
  skipped: Record<ISODate, string[]>;
  /** Asistencia marcada: fecha → id de bloque → fui/falté. */
  attendance: Record<ISODate, Record<string, Attendance>>;
  events: CalendarEvent[];
  rewards: Reward[];
  stars: StarTx[];
  settings: Settings;
}
