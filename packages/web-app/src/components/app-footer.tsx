import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDaemonStatus } from 'domains/daemon/requests';
import { sameOriginApi } from 'utils/http';
import { REPO_URL } from '@web-app/constants/links';

function KombinatCopyright() {
  const { data } = useQuery({
    queryKey: ['status'],
    queryFn: () => getDaemonStatus(sameOriginApi),
  });
  return (
    <>
      {data?.version !== undefined && `v${data.version} · `}© {new Date().getFullYear()}{' '}
      <span className="text-fg">Kombinat</span> ·{' '}
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 transition-colors hover:text-fg"
      >
        GitHub
        <ArrowUpRight aria-hidden="true" className="size-3" />
      </a>
    </>
  );
}

interface AppFooterProps {
  children?: ReactNode;
}

export function AppFooter({ children }: AppFooterProps) {
  return (
    <footer className="mx-auto flex max-w-[1180px] flex-col items-center gap-5 px-4 pb-10 sm:px-6">
      <span
        aria-hidden="true"
        className="h-px w-full max-w-md bg-linear-to-r from-transparent via-line-strong to-transparent"
      />
      <p className="text-caption font-normal text-fg-muted">{children ?? <KombinatCopyright />}</p>
    </footer>
  );
}
