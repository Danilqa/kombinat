import { chromium, type Browser, type BrowserContext } from 'playwright';
import { DEVICE_SCALE, VIEWPORT } from '../src/timeline';
import { serveSites, type Site } from './serve-sites';

export interface Session {
  browser: Browser;
  context: BrowserContext;
}

export async function openSession(sites: Site[]): Promise<Session> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  await serveSites(context, sites);
  return { browser, context };
}
