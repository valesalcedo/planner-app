import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles/global.css';

// Actualiza la app sola cuando subes una versión nueva a GitHub.
registerSW({ immediate: true });

// Pide al navegador que no borre los datos guardados cuando falte espacio.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
