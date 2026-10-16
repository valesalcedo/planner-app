import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { applyTheme } from './lib/theme';
import { useStore } from './store/useStore';
import './styles/global.css';

// Actualiza la app sola cuando subes una versión nueva a GitHub.
registerSW({ immediate: true });

// Pide al navegador que no borre los datos guardados cuando falte espacio.
navigator.storage?.persist?.().catch(() => {});

// Pinta la app con el tema guardado antes de mostrarla, y de nuevo cada vez que cambie.
applyTheme(useStore.getState().settings.theme);
useStore.subscribe((s, prev) => {
  if (s.settings.theme !== prev.settings.theme) applyTheme(s.settings.theme);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
