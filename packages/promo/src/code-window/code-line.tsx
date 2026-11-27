import type { CSSProperties } from 'react';
import { cn } from 'design-system';

export type CodeTone = 'faint' | 'key' | 'value' | 'string' | 'comment' | 'prose' | 'added';

export interface CodeToken {
  text: string;
  tone: CodeTone;
}

const TONE_CLASS_NAMES: Record<CodeTone, string> = {
  faint: 'text-fg-faint',
  key: 'text-fg-muted',
  value: 'text-fg',
  string: 'text-brand-peach',
  comment: 'text-fg-faint',
  prose: 'text-fg-prose',
  added: 'text-positive',
};

interface CodeLineProps {
  tokens: CodeToken[];
  number?: number;
  style?: CSSProperties;
  className?: string;
}

export function CodeLine({ tokens, number, style, className }: CodeLineProps) {
  return (
    <div style={style} className={cn('flex whitespace-pre', className)}>
      {number !== undefined && (
        <span className="w-9 shrink-0 pr-4 text-right text-fg-faint select-none">{number}</span>
      )}
      <span>
        {tokens.map((token, index) => (
          <span key={index} className={TONE_CLASS_NAMES[token.tone]}>
            {token.text}
          </span>
        ))}
      </span>
    </div>
  );
}
