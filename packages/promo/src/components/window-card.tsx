import type { CSSProperties, ReactNode } from 'react';
import { cn } from 'design-system/utils';

interface WindowCardProps {
  folder?: string;
  file: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function WindowCard({ folder, file, children, className, style }: WindowCardProps) {
  return (
    <div
      style={style}
      className={cn(
        'overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]',
        className,
      )}
    >
      <div className="flex h-10 items-center gap-4 border-b border-line px-4">
        <div className="flex gap-2">
          <span className="size-3 rounded-full bg-[#ec5f57]" />
          <span className="size-3 rounded-full bg-[#e0a33b]" />
          <span className="size-3 rounded-full bg-[#4cb963]" />
        </div>
        <span className="font-mono text-[13px] text-fg-muted">
          {folder}
          <span className="text-fg">{file}</span>
        </span>
      </div>
      {children}
    </div>
  );
}
