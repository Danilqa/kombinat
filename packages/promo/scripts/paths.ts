import path from 'node:path';

export const PROMO_ROOT = path.join(import.meta.dirname, '..');
export const OUT_DIR = path.join(PROMO_ROOT, 'out');
export const PROMO_DIST = path.join(PROMO_ROOT, 'dist');
export const WEBSITE_DIST = path.join(PROMO_ROOT, '..', 'website', 'dist');
