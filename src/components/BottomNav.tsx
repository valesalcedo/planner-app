import { useStore } from '../store/useStore';
import { type Tab, useUI } from '../store/useUI';
import { Icon, type IconName } from './Icon';
import styles from './BottomNav.module.css';

const ITEMS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: 'hoy', label: 'Hoy', icon: 'list' },
  { tab: 'calendario', label: 'Calendario', icon: 'calendar' },
  { tab: 'foco', label: 'Foco', icon: 'timer' },
  { tab: 'stats', label: 'Semana', icon: 'chart' },
  { tab: 'menu', label: 'Menú', icon: 'grid' },
];

/** Tienda y Logros se abren desde el Menú, así que el Menú queda marcado. */
const SECTION: Partial<Record<Tab, Tab>> = { tienda: 'menu', logros: 'menu' };

export function BottomNav() {
  const tab = useUI((s) => s.tab);
  const page = useUI((s) => s.page);
  const setTab = useUI((s) => s.setTab);
  const timerOn = useStore((s) => s.activeTimer !== null);

  return (
    <nav className={styles.nav} aria-label="Secciones">
      {ITEMS.map((item) => {
        const active = (SECTION[tab] ?? tab) === item.tab && page === null;
        return (
          <button
            key={item.tab}
            type="button"
            className={styles.item}
            aria-current={active ? 'page' : undefined}
            onClick={() => setTab(item.tab)}
          >
            <span className={styles.iconWrap}>
              <Icon name={item.icon} size={24} />
              {item.tab === 'foco' && timerOn && <span className={styles.dot} aria-label="Cronómetro activo" />}
            </span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
