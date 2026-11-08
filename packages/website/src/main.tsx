import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from 'web-app/app';
import { installDemoApi } from './demo-api/install';
import './index.css';

installDemoApi();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
