import { ArrowUp, Loader } from 'lucide-react';
import { useId, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import { match, P } from 'ts-pattern';

import { Button } from 'design-system';
import { getAgentLabel } from 'domains/agent/utils';
import type { RunRecord } from 'domains/run/types';
import { checkIsRunActive } from 'domains/run/utils';
import { useSendRunMessage } from '../queries';

function getPlaceholder(run: RunRecord): string {
  const agent = getAgentLabel(run.agent);
  return match(run)
    .with({ replyPid: P.number }, () => `${agent} is replying…`)
    .with(
      { status: P.union('running', 'waiting', 'retrying') },
      () => 'Send a message once the run is done',
    )
    .otherwise(() => `Message ${agent}`);
}

interface RunMessageFormProps {
  run: RunRecord;
  onSent: () => void;
}

export function RunMessageForm({ run, onSent }: RunMessageFormProps) {
  const id = useId();
  const [text, setText] = useState('');
  const { mutate, isPending, error } = useSendRunMessage(run.routine, run.id, () => {
    setText('');
    onSent();
  });
  const isBusy = checkIsRunActive(run) || isPending;
  // aria-disabled instead of disabled keeps keyboard focus on the button after it is pressed.
  const isUnavailable = isBusy || text.trim() === '';

  function send(event: SyntheticEvent) {
    event.preventDefault();
    if (!isUnavailable) mutate(text);
  }

  function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) send(event);
  }

  return (
    <form
      onSubmit={send}
      className="rounded-2xl border border-line bg-surface p-2 shadow-popover transition-colors focus-within:border-line-strong"
    >
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          Message
        </label>
        <textarea
          id={id}
          rows={1}
          value={text}
          placeholder={getPlaceholder(run)}
          onChange={event => setText(event.target.value)}
          onKeyDown={sendOnEnter}
          className="field-sizing-content max-h-48 min-h-7 flex-1 resize-none bg-transparent px-2 py-1 text-body text-fg placeholder:text-fg-muted focus-visible:shadow-none"
        />
        <Button
          type="submit"
          size="icon-small"
          className="max-sm:size-8"
          aria-disabled={isUnavailable || undefined}
        >
          {isBusy ? (
            <Loader aria-hidden="true" className="size-3.5 spin-in-place" />
          ) : (
            <ArrowUp aria-hidden="true" className="size-4" strokeWidth={2.5} />
          )}
          <span className="sr-only">Send message</span>
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="animate-in px-2 pt-1 text-body-sm text-negative duration-200 fade-in"
        >
          {error.message}
        </p>
      )}
    </form>
  );
}
