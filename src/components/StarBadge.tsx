import { useBalance } from '../hooks/useDerived';
import { useUI } from '../store/useUI';
import { Icon } from './Icon';
import styles from './StarBadge.module.css';

export function StarBadge() {
  const balance = useBalance();
  const setTab = useUI((s) => s.setTab);
  return (
    <button type="button" className={styles.badge} onClick={() => setTab('tienda')} aria-label={`${balance} estrellas, abrir tienda`}>
      <Icon name="star" size={18} />
      {balance}
    </button>
  );
}
