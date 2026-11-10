import { AppFooter } from 'web-app/components/app-footer';

export function SiteFooter() {
  return (
    <AppFooter>
      © {new Date().getFullYear()} <span className="text-fg">Daniil Sitdikov</span>
    </AppFooter>
  );
}
