import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from 'web-app/app';
import { CHANGELOG_PATH } from './constants';
import { installDemoApi } from './demo-api/install';
import { ChangelogPage } from './features/changelog/changelog-page';
import { SiteFooter } from './layout/site-footer';
import { StarBar } from './layout/star-bar';
import { WelcomeBanner } from './features/welcome/welcome-banner';
import './index.css';

installDemoApi();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <App
      customization={{
        announcement: <StarBar />,
        banner: <WelcomeBanner />,
        footer: <SiteFooter />,
        routes: [{ path: CHANGELOG_PATH, element: <ChangelogPage /> }],
        routinesTitle: 'Demo routines',
      }}
    />
  </StrictMode>,
);
