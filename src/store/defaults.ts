import type { AppData, Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  dayStart: '08:00',
  dayEnd: '22:00',
  bufferMin: 5,
  starsPerMinute: 1,
  bonus: { facil: 5, media: 10, dificil: 20 },
  streakDays: 3,
  streakMultiplier: 1.2,
};

export const COURSE_COLORS = ['#F9C6D5', '#FDE68A', '#DCD6F7', '#C9EBD8', '#FFD6B8', '#C7E3F5'];

export function initialData(): AppData {
  return {
    version: 1,
    courses: [],
    activityTypes: [
      { id: 'catedra', name: 'Cátedra (clases)' },
      { id: 'ayudantia', name: 'Ayudantía o laboratorio' },
      { id: 'estudio', name: 'Estudio personal' },
      { id: 'tareas', name: 'Tareas y proyectos' },
      { id: 'evaluacion', name: 'Evaluaciones' },
      { id: 'otro', name: 'Otro' },
    ],
    tasks: [],
    entries: [],
    activeTimer: null,
    weekly: [],
    skipped: {},
    events: [],
    rewards: [
      { id: 'r-pelicula', name: 'Ver una película', price: 180 },
      { id: 'r-rico', name: 'Comprarme algo rico', price: 90 },
      { id: 'r-capitulo', name: 'Un capítulo de serie', price: 60 },
      { id: 'r-siesta', name: 'Siesta sin culpa', price: 120 },
      { id: 'r-cafe', name: 'Salir por un café', price: 150 },
      { id: 'r-tarde', name: 'Tarde libre', price: 600 },
    ],
    stars: [],
    settings: DEFAULT_SETTINGS,
  };
}
