import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { useAchievementStatus } from '../../hooks/useAchievements';
import { GROUPS, type AchievementGroup } from '../../lib/achievements';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import styles from './Achievements.module.css';
import { progressShare, progressText, tierName } from './progressText';

type Filter = 'todos' | 'ganados' | 'pendientes';

/** Colores de la medalla según la categoría (siguen el tema elegido). */
const GROUP_COLORS: Record<AchievementGroup, { bg: string; ink: string }> = {
  clases: { bg: 'var(--lavender)', ink: 'var(--lavender-ink)' },
  foco: { bg: 'var(--primary-soft)', ink: 'var(--primary-deep)' },
  tareas: { bg: 'var(--mint)', ink: 'var(--mint-ink)' },
  rachas: { bg: 'var(--accent)', ink: 'var(--accent-ink)' },
  ramos: { bg: 'var(--primary-tint)', ink: 'var(--primary-deep)' },
  habitos: { bg: 'var(--accent-soft)', ink: 'var(--accent-ink)' },
};

const TIER_RING = ['#C98A4B', '#9AA0AE', '#E0A800', '#5BB5E0'];

export function AchievementsScreen() {
  const statuses = useAchievementStatus();
  const stars = useStore((s) => s.stars);
  const setTab = useUI((s) => s.setTab);
  const [filter, setFilter] = useState<Filter>('todos');

  const earned = statuses.filter((a) => a.level > 0).length;
  const fromAchievements = useMemo(() => stars.filter((t) => t.kind === 'logro').reduce((s, t) => s + t.amount, 0), [stars]);
  const latest = useMemo(() => [...stars].reverse().find((t) => t.kind === 'logro'), [stars]);

  const visible = statuses.filter((a) =>
    filter === 'todos' ? true : filter === 'ganados' ? a.level > 0 : a.next !== null,
  );

  return (
    <div className="screen">
      <header className="screen-header" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="icon-btn" aria-label="Volver al menú" onClick={() => setTab('menu')}>
          <Icon name="back" />
        </button>
        <h1 className="title">Logros</h1>
      </header>

      <section className="card card--lg stack" style={{ gap: 12 }} aria-label="Resumen de logros">
        <div className="row row--between" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 0 }}>
            <span className={styles.count}>
              {earned} de {statuses.length}
            </span>
            <span className="small muted">logros desbloqueados</span>
          </div>
          {fromAchievements > 0 && (
            <span className={styles.starsChip}>
              <Icon name="star" size={16} /> +{fromAchievements.toLocaleString('es-CL')}
            </span>
          )}
        </div>
        <div className="progress" role="progressbar" aria-valuenow={earned} aria-valuemin={0} aria-valuemax={statuses.length} aria-label="Logros desbloqueados">
          <span style={{ width: `${(earned / statuses.length) * 100}%` }} />
        </div>
        {latest && (
          <div className={styles.latest}>
            <span className={styles.latestIcon}>
              <Icon name="medal" size={20} />
            </span>
            <span className="stack" style={{ gap: 0, minWidth: 0 }}>
              <span className="small" style={{ fontWeight: 800, color: 'var(--primary-deep)' }}>
                Último logro · {new Date(latest.at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
              </span>
              <span style={{ fontWeight: 800, fontSize: 14 }}>
                {latest.reason.replace(/^Logro: /, '')}
                {latest.amount > 0 ? ` · +${latest.amount}` : ''}
              </span>
            </span>
          </div>
        )}
      </section>

      <div className="pills" role="group" aria-label="Filtrar logros">
        {(
          [
            ['todos', 'Todos'],
            ['ganados', 'Ganados'],
            ['pendientes', 'Por ganar'],
          ] as const
        ).map(([id, text]) => (
          <button key={id} type="button" className="pill" aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {text}
          </button>
        ))}
      </div>

      {GROUPS.map((g) => {
        const items = visible.filter((a) => a.group === g.id);
        if (items.length === 0) return null;
        const all = statuses.filter((a) => a.group === g.id);
        const colors = GROUP_COLORS[g.id];
        return (
          <section key={g.id} className="stack" style={{ gap: 10 }} aria-labelledby={`ach-${g.id}`}>
            <div className="row row--between">
              <h2 id={`ach-${g.id}`} className="section-title" style={{ fontSize: 16 }}>
                {g.title}
              </h2>
              <span className="small muted" style={{ fontWeight: 800 }}>
                {all.filter((a) => a.level > 0).length} de {all.length}
              </span>
            </div>
            <ul className={styles.grid}>
              {items.map((a) => {
                const won = a.level > 0;
                const started = a.value > 0;
                const tier = tierName(a);
                const text = progressText(a);
                const share = progressShare(a);
                const status = a.next
                  ? [tier, started ? text : '', a.next.stars > 0 ? `+${a.next.stars}` : 'Medalla']
                  : [tier, a.tiers.length > 1 ? 'Completo' : 'Ganado'];
                return (
                  <li key={a.id} className={`${styles.card} ${!won && !started ? styles.locked : ''}`}>
                    <span
                      className={styles.medal}
                      style={
                        won
                          ? {
                              background: colors.bg,
                              color: colors.ink,
                              boxShadow: `0 0 0 3px var(--surface), 0 0 0 5px ${a.tiers.length > 1 ? TIER_RING[a.level - 1] : colors.bg}`,
                            }
                          : undefined
                      }
                    >
                      <Icon name={won || started ? 'star' : 'lock'} size={won || started ? 26 : 22} style={won ? undefined : { opacity: 0.6 }} />
                    </span>
                    <span className={styles.name}>{a.title}</span>
                    <span className={styles.desc}>{a.desc}</span>
                    {a.next && started && a.next.goal > 1 && (
                      <span className={styles.bar} role="progressbar" aria-valuenow={Math.min(a.value, a.next.goal)} aria-valuemin={0} aria-valuemax={a.next.goal} aria-label={`Avance en ${a.title}`}>
                        <span style={{ width: `${share * 100}%`, background: colors.ink }} />
                      </span>
                    )}
                    <span className={styles.status} style={won ? { color: colors.ink } : undefined}>
                      {status.filter(Boolean).join(' · ')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
