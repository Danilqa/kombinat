import type { KeyboardEvent, ReactNode } from 'react';
import { Card, Kbd } from 'design-system/components';
import { cn } from 'design-system/utils';
import { isApplePlatform } from '@web-app/hooks/use-search-shortcut';

const RUN_SHORTCUT_LABEL = isApplePlatform ? '⌘↵' : 'Ctrl ↵';

function checkIsRunShortcut(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

function submitOnShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (!checkIsRunShortcut(event)) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PromptEditor({
  value,
  onChange,
  header,
  footer,
  placeholder,
  autoFocus,
}: PromptEditorProps) {
  return (
    <Card.Root className="gap-0 py-0 transition-colors focus-within:border-line-strong">
      {header && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-6 py-2.5 text-body-sm text-fg-muted">
          {header}
        </div>
      )}
      <textarea
        aria-label="Prompt"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={event => onChange(event.target.value)}
        onKeyDown={submitOnShortcut}
        spellCheck={false}
        className="min-h-[60vh] w-full resize-y bg-transparent p-6 font-mono text-body-sm/relaxed text-fg outline-none placeholder:text-fg-muted focus-visible:shadow-none"
      />
      {/* Phones have no shortcut, so a footer without its own content would stay empty. */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-t border-line px-6 py-2.5 text-body-sm text-fg-muted',
          !footer && 'justify-end max-sm:hidden',
        )}
      >
        {footer}
        <span className="flex shrink-0 items-center gap-1.5 max-sm:hidden">
          <Kbd>{RUN_SHORTCUT_LABEL}</Kbd> to run
        </span>
      </div>
    </Card.Root>
  );
}
