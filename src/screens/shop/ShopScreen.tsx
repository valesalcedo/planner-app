import { type FormEvent, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useBalance, useStreak } from '../../hooks/useDerived';
import { useStore } from '../../store/useStore';
import { useUI } from '../../store/useUI';
import type { Reward } from '../../types';
import styles from './Shop.module.css';

const ACCENTS = ['var(--pink-soft)', 'var(--yellow)', 'var(--lavender)', 'var(--mint)'];

export function ShopScreen() {
  const balance = useBalance();
  const { streak, multiplier } = useStreak();
  const rewards = useStore((s) => s.rewards);
  const stars = useStore((s) => s.stars);
  const settings = useStore((s) => s.settings);
  const redeem = useStore((s) => s.redeem);
  const deleteStarTx = useStore((s) => s.deleteStarTx);
  const [showAll, setShowAll] = useState(false);
  const showToast = useUI((s) => s.showToast);
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);

  const history = [...stars].reverse().slice(0, showAll ? undefined : 12);
  const sorted = [...rewards].sort((a, b) => a.price - b.price);

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="title">Tienda de permisos</h1>
      </header>

      <div className={styles.balance}>
        <div className="row" style={{ gap: 10 }}>
          <Icon name="star" size={42} />
          <div className="stack" style={{ gap: 0 }}>
            <span className={styles.balanceValue}>{balance}</span>
            <span className="small" style={{ fontWeight: 700, color: 'var(--yellow-deep)' }}>
              estrellas disponibles
            </span>
          </div>
        </div>
        <div className={styles.rules}>
          <span>{settings.starsPerMinute} por minuto de foco</span>
          <span>
            +{settings.bonus.facil} a +{settings.bonus.dificil} por tarea
          </span>
          {settings.starsPerClass > 0 && <span>+{settings.starsPerClass} por ir a clases</span>}
          <span>
            Racha {settings.streakDays}+ días ×{settings.streakMultiplier}
          </span>
        </div>
        {streak > 0 && (
          <span className="small" style={{ fontWeight: 700, color: 'var(--yellow-deep)' }}>
            Llevas {streak} {streak === 1 ? 'día' : 'días'} de racha
            {multiplier > 1 ? `: tus estrellas valen ×${multiplier}` : ''}
          </span>
        )}
      </div>

      <div className="row row--between">
        <h2 className="section-title">Mis premios</h2>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Crear premio
        </button>
      </div>

      <ul className={styles.grid}>
        {sorted.map((r, i) => {
          const ok = balance >= r.price;
          return (
            <li key={r.id} className={styles.reward}>
              <div className="row row--between">
                <span className={styles.accent} style={{ background: ACCENTS[i % ACCENTS.length] }} aria-hidden="true" />
                <button type="button" className="icon-btn icon-btn--plain" style={{ width: 36, height: 36, margin: -8 }} aria-label={`Editar ${r.name}`} onClick={() => setEditing(r)}>
                  <Icon name="edit" size={16} />
                </button>
              </div>
              <span className={styles.rewardName}>{r.name}</span>
              <div className="row row--between">
                <span className="row" style={{ gap: 4, fontWeight: 800 }}>
                  <Icon name="star" size={14} />
                  {r.price}
                </span>
                <button
                  type="button"
                  className={`btn btn--sm ${ok ? 'btn--primary' : ''}`}
                  disabled={!ok}
                  aria-label={ok ? `Canjear ${r.name}` : `Te faltan ${r.price - balance} estrellas para ${r.name}`}
                  onClick={() => {
                    if (confirm(`¿Canjear "${r.name}" por ${r.price} estrellas?`) && redeem(r.id)) {
                      showToast(`¡Disfruta: ${r.name}!`);
                    }
                  }}
                >
                  {ok ? 'Canjear' : `Faltan ${r.price - balance}`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {history.length > 0 && (
        <section className="card stack" aria-labelledby="hist-title">
          <h2 id="hist-title" className="section-title">
            Movimientos recientes
          </h2>
          <p className="small muted" style={{ margin: 0 }}>
            Si algo quedó mal (por ejemplo, una tarea de prueba), puedes quitar el movimiento con la ×.
          </p>
          {history.map((t) => (
            <div key={t.id} className="row row--between small" style={{ gap: 4 }}>
              <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.reason}</span>
              <span style={{ fontWeight: 800, color: t.amount < 0 ? 'var(--pink-deep)' : 'var(--mint-ink)', flexShrink: 0 }}>
                {t.amount > 0 ? `+${t.amount}` : t.amount}
              </span>
              <button
                type="button"
                className="icon-btn icon-btn--plain"
                style={{ width: 36, height: 36, margin: '-6px -8px -6px 0', flexShrink: 0 }}
                aria-label={`Quitar movimiento: ${t.reason}`}
                onClick={() => {
                  const sign = t.amount > 0 ? 'bajará' : 'subirá';
                  if (confirm(`¿Quitar "${t.reason}" (${t.amount > 0 ? '+' : ''}${t.amount})? Tu saldo ${sign} ${Math.abs(t.amount)}.`)) {
                    deleteStarTx(t.id);
                  }
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          {stars.length > 12 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver menos' : `Ver todos (${stars.length})`}
            </button>
          )}
        </section>
      )}

      {editing && <RewardForm reward={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RewardForm({ reward, onClose }: { reward?: Reward; onClose: () => void }) {
  const saveReward = useStore((s) => s.saveReward);
  const deleteReward = useStore((s) => s.deleteReward);
  const [name, setName] = useState(reward?.name ?? '');
  const [price, setPrice] = useState(reward?.price ?? 100);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price <= 0) return;
    saveReward({ ...(reward ? { id: reward.id } : {}), name: name.trim(), price: Math.round(price) });
    onClose();
  };

  return (
    <Sheet
      title={reward ? 'Editar premio' : 'Nuevo premio'}
      onClose={onClose}
      footer={
        <>
          {reward && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                deleteReward(reward.id);
                onClose();
              }}
            >
              Borrar
            </button>
          )}
          <button type="submit" form="reward-form" className="btn btn--primary btn--block" disabled={!name.trim() || price <= 0}>
            Guardar
          </button>
        </>
      }
    >
      <form id="reward-form" className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="rw-name">Premio</label>
          <input id="rw-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pedir sushi" required />
        </div>
        <div className="field">
          <label htmlFor="rw-price">Precio en estrellas</label>
          <input id="rw-price" type="number" inputMode="numeric" min={1} className="input" value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} required />
          <span className="small muted">Como referencia, 60 estrellas son 1 hora de foco.</span>
        </div>
      </form>
    </Sheet>
  );
}
