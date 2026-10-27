import { Icon, type IconName } from '../../components/Icon';
import { useAchievementStatus } from '../../hooks/useAchievements';
import { useBalance } from '../../hooks/useDerived';
import { type Page, useUI } from '../../store/useUI';
import { progressShare, progressText } from '../achievements/progressText';
import styles from './Menu.module.css';

const MORE: { label: string; icon: IconName; page: Exclude<Page, null> }[] = [
  { label: 'Tema y colores', icon: 'palette', page: 'ajustes' },
  { label: 'Horario semanal', icon: 'calendar', page: 'horario' },
  { label: 'Ajustes', icon: 'gear', page: 'ajustes' },
  { label: 'Papelera', icon: 'trash', page: 'papelera' },
];

export function MenuScreen() {
  const balance = useBalance();
  const statuses = useAchievementStatus();
  const setTab = useUI((s) => s.setTab);
  const openPage = useUI((s) => s.openPage);

  const earned = statuses.filter((a) => a.level > 0).length;
  // El logro en camino que tienes más cerca.
  const closest = statuses
    .filter((a) => a.next && a.value > 0 && a.next.goal > 1)
    .sort((a, b) => progressShare(b) - progressShare(a))[0];

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="title">Menú</h1>
      </header>

      <div className="grid-2" style={{ gap: 12 }}>
        <button type="button" className={`${styles.big} ${styles.shop}`} onClick={() => setTab('tienda')}>
          <span className={styles.bigIcon}>
            <Icon name="bag" size={26} />
          </span>
          <span className={styles.bigTitle}>Tienda</span>
          <span className={styles.bigFoot} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            <span className="row" style={{ gap: 6 }}>
              <Icon name="star" size={18} /> {balance.toLocaleString('es-CL')}
            </span>
            <span className="small" style={{ fontWeight: 700, color: 'var(--accent-ink)' }}>
              para canjear
            </span>
          </span>
        </button>
        <button type="button" className={`${styles.big} ${styles.medals}`} onClick={() => setTab('logros')}>
          <span className={styles.bigIcon}>
            <Icon name="medal" size={26} />
          </span>
          <span className={styles.bigTitle}>Logros</span>
          <span className={styles.bigFoot} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <span>
              {earned} de {statuses.length}
            </span>
            <span className={styles.meter} aria-hidden="true">
              <span style={{ width: `${(earned / statuses.length) * 100}%` }} />
            </span>
          </span>
        </button>
      </div>

      {closest && (
        <button type="button" className={`card ${styles.closest}`} onClick={() => setTab('logros')}>
          <span className={styles.closestIcon}>
            <Icon name="trend" size={20} />
          </span>
          <span className="stack" style={{ gap: 0, minWidth: 0, textAlign: 'left' }}>
            <span className="small" style={{ fontWeight: 800, color: 'var(--primary-deep)' }}>
              Te falta poco
            </span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              {closest.title} · {progressText(closest)}
            </span>
          </span>
        </button>
      )}

      <h2 className={styles.more}>Más</h2>
      <ul className={`card ${styles.list}`}>
        {MORE.map((item) => (
          <li key={item.label}>
            <button type="button" className={styles.item} onClick={() => openPage(item.page)}>
              <Icon name={item.icon} size={22} style={{ color: 'var(--primary-deep)' }} />
              <span className={styles.itemLabel}>{item.label}</span>
              <Icon name="next" size={16} style={{ color: 'var(--ink-2)' }} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
