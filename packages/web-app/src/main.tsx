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
