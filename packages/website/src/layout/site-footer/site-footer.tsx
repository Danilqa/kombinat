import { Link } from 'react-router';
import { AppFooter } from 'web-app/layout/app-footer';
import { CHANGELOG_PATH } from '../../constants';

export function SiteFooter() {
  return (
    <AppFooter>
      © {new Date().getFullYear()} <span className="text-fg">Daniil Sitdikov</span> ·{' '}
      <Link
        to={CHANGELOG_PATH}
        className="relative transition-colors after:absolute after:-inset-x-2 after:-inset-y-3 hover:text-fg"
      >
        Changelog
      </Link>
    </AppFooter>
  );
}
