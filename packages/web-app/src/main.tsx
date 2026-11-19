import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@web-app/app';
import '@web-app/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// A dev server's origin is shared with other projects, so only the daemon's build registers it.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js');
}
