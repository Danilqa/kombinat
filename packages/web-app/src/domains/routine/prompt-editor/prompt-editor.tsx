import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { Card, Kbd, cn } from 'design-system';
import { isApplePlatform } from '@web-app/hooks';

const SUBMIT_SHORTCUT_LABEL = isApplePlatform ? '⌘↵' : 'Ctrl ↵';

function checkIsSubmitShortcut(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

function submitOnShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (!checkIsSubmitShortcut(event)) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

interface PromptEditorProps {
  value: string;
  label?: string;
  submitLabel?: string;
  onChange: (value: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
  placeholder?: string;
  autoFocus?: boolean;
  inputClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function PromptEditor({
  value,
  label = 'Prompt',
  submitLabel = 'run',
  onChange,
  header,
  footer,
  placeholder,
  autoFocus,
  inputClassName,
  ref,
}: PromptEditorProps) {
  return (
    <Card.Root className="transition-colors focus-within:border-line-strong">
      {header && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-6 py-2.5 text-body-sm text-fg-muted">
          {header}
        </div>
      )}
      <textarea
        ref={ref}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={event => onChange(event.target.value)}
        onKeyDown={submitOnShortcut}
        spellCheck={false}
        className={cn(
          'min-h-[60vh] w-full resize-y bg-transparent p-6 font-mono text-body-sm/relaxed text-fg placeholder:text-fg-muted focus-visible:shadow-none',
          inputClassName,
        )}
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
          <Kbd>{SUBMIT_SHORTCUT_LABEL}</Kbd> to {submitLabel}
        </span>
      </div>
    </Card.Root>
  );
}
