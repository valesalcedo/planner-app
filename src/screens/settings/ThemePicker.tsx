import { ColorPicker } from '../../components/ColorPicker';
import { Icon } from '../../components/Icon';
import { customBase, DEFAULT_THEME, THEME_PRESETS, type ThemeBase } from '../../lib/theme';
import { useStore } from '../../store/useStore';
import styles from './ThemePicker.module.css';

const CUSTOM_PRIMARY = '#F48FB1';
const CUSTOM_ACCENT = '#FDE68A';

/** Elegir los colores de toda la app: un tema listo o uno propio con dos colores. */
export function ThemePicker() {
  const theme = useStore((s) => s.settings.theme) ?? DEFAULT_THEME;
  const updateSettings = useStore((s) => s.updateSettings);

  const primary = theme.primary ?? CUSTOM_PRIMARY;
  const accent = theme.accent ?? CUSTOM_ACCENT;
  const dark = !!theme.dark;
  const isCustom = theme.id === 'custom';

  // Se guardan siempre los colores propios, así no se pierden al probar otro tema.
  const choose = (id: string) => updateSettings({ theme: { ...theme, id } });
  const setCustom = (patch: { primary?: string; accent?: string; dark?: boolean }) =>
    updateSettings({ theme: { primary, accent, dark, ...patch, id: 'custom' } });

  return (
    <section className="card card--lg stack" aria-labelledby="theme-title">
      <h2 id="theme-title" className="section-title">
        Tema
      </h2>
      <p className="small muted" style={{ margin: 0 }}>
        Cambia los colores de toda la app. Los colores de tus ramos y categorías se mantienen.
      </p>
      <div className={styles.grid} role="group" aria-label="Temas">
        {THEME_PRESETS.map((p) => (
          <ThemeCard key={p.id} name={p.name} base={p.base} selected={theme.id === p.id} onSelect={() => choose(p.id)} />
        ))}
        <ThemeCard name="Tú eliges" base={customBase(primary, accent, dark)} selected={isCustom} onSelect={() => setCustom({})} />
      </div>

      {isCustom && (
        <div className="stack" style={{ gap: 12, marginTop: 4 }}>
          <div className={styles.customRow}>
            <ColorPicker value={primary} label="botones y detalles" onChange={(c) => setCustom({ primary: c })} />
            <span className="stack" style={{ gap: 0 }}>
              <span style={{ fontWeight: 800 }}>Color principal</span>
              <span className="small muted">Botones, fondo y detalles</span>
            </span>
          </div>
          <div className={styles.customRow}>
            <ColorPicker value={accent} label="estrellas y resaltados" onChange={(c) => setCustom({ accent: c })} />
            <span className="stack" style={{ gap: 0 }}>
              <span style={{ fontWeight: 800 }}>Color de acento</span>
              <span className="small muted">Estrellas, tienda y resaltados</span>
            </span>
          </div>
          <label className="switch-row">
            <span style={{ fontWeight: 800 }}>Modo oscuro</span>
            <input type="checkbox" className="switch" checked={dark} onChange={(e) => setCustom({ dark: e.target.checked })} />
          </label>
        </div>
      )}
    </section>
  );
}

function ThemeCard({ name, base, selected, onSelect }: { name: string; base: ThemeBase; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={styles.card} aria-pressed={selected} onClick={onSelect} style={{ background: base.bg, color: base.ink }}>
      <span className={styles.preview} aria-hidden="true">
        <span className={styles.bar} style={{ background: base.surface }}>
          <span className={styles.dot} style={{ background: base.primary }} />
          <span className={styles.dot} style={{ background: base.accent }} />
        </span>
      </span>
      <span className={styles.name}>{name}</span>
      {selected && (
        <span className={styles.check} aria-hidden="true">
          <Icon name="check" size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
