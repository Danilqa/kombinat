import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDaemonStatus } from 'domains/daemon/requests';
import { GITHUB_REPO_URL } from 'domains/release/constants';
import { sameOriginApi } from 'utils/http';
import { CHANGELOG_URL } from '@web-app/constants/links';

interface FooterLinkProps {
  href: string;
  children: ReactNode;
}

function FooterLink({ href, children }: FooterLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-0.5 transition-colors hover:text-fg"
    >
      {children}
      {/* Takes back the icon's inner padding, so the gap before the next "·" matches the others. */}
      <ArrowUpRight
        aria-hidden="true"
        className="-mr-0.75 size-3 transition-transform duration-200 ease-out-quint group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </a>
  );
}

function KombinatCopyright() {
  const { data } = useQuery({
    queryKey: ['status'],
    queryFn: () => getDaemonStatus(sameOriginApi),
  });
  return (
    <>
      {data?.version !== undefined && `v${data.version} · `}© {new Date().getFullYear()}{' '}
      <span className="text-fg">Kombinat</span> ·{' '}
      <FooterLink href={CHANGELOG_URL}>Changelog</FooterLink> ·{' '}
      <FooterLink href={GITHUB_REPO_URL}>GitHub</FooterLink>
    </>
  );
}

interface AppFooterProps {
  children?: ReactNode;
}

export function AppFooter({ children }: AppFooterProps) {
  return (
    <footer className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-5 px-4 pb-10 sm:px-6">
      <span
        aria-hidden="true"
        className="h-px w-full max-w-md bg-linear-to-r from-transparent via-line-strong to-transparent"
      />
      <p className="text-caption font-normal text-fg-muted">{children ?? <KombinatCopyright />}</p>
    </footer>
  );
}
