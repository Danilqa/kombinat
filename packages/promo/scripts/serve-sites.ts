import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext } from 'playwright';
import { PROMO_DIST, WEBSITE_DIST } from './paths';

export interface Site {
  origin: string;
  base: string;
  dist: string;
}

export const PROMO_SITE: Site = { origin: 'http://promo.test', base: '/', dist: PROMO_DIST };
export const WEBSITE_SITE: Site = {
  origin: 'http://kombinat.test',
  base: '/kombinat/',
  dist: WEBSITE_DIST,
};

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function findFile(site: Site, pathname: string): string {
  const relative = pathname.slice(site.base.length);
  const file = path.join(site.dist, relative);
  const isFile = relative !== '' && fs.existsSync(file) && fs.statSync(file).isFile();
  return isFile ? file : path.join(site.dist, 'index.html');
}

// Serves the built sites from their dist folders, so recording needs no dev server or port.
export async function serveSites(context: BrowserContext, sites: Site[]) {
  for (const site of sites) {
    if (!fs.existsSync(path.join(site.dist, 'index.html'))) {
      throw new Error(`${site.dist} has no build`);
    }
  }
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (FONT_HOSTS.has(url.hostname)) {
      await route.continue();
      return;
    }
    const site = sites.find(candidate => candidate.origin === url.origin);
    if (site === undefined) {
      await route.abort();
      return;
    }
    const file = findFile(site, url.pathname);
    await route.fulfill({
      path: file,
      contentType: CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
    });
  });
}
