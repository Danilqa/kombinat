import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Loader } from 'lucide-react';
import { useId, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import { match, P } from 'ts-pattern';

import { Button } from 'design-system/components';
import { sameOriginApi } from 'utils/http';

import { getAgentLabel } from '../../agent/utils';
import { QUERY_KEYS_CHANGED_BY_MESSAGE } from '../constants';
import { sendRunMessage } from '../requests';
import type { RunRecord } from '../types';
import { checkIsRunActive } from '../utils';

function getPlaceholder(run: RunRecord): string {
  const agent = getAgentLabel(run.agent);
  return match(run)
    .with({ replyPid: P.number }, () => `${agent} is replying…`)
    .with({ status: P.union('running', 'waiting') }, () => 'Send a message once the run is done')
    .otherwise(() => `Message ${agent}`);
}

interface RunMessageFormProps {
  run: RunRecord;
  onSent: () => void;
}

export function RunMessageForm({ run, onSent }: RunMessageFormProps) {
  const id = useId();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const { mutate, isPending, error } = useMutation({
    mutationFn: (message: string) => sendRunMessage(sameOriginApi, run.routine, run.id, message),
    onSuccess: () => {
      setText('');
      onSent();
      return Promise.all(
        QUERY_KEYS_CHANGED_BY_MESSAGE.map(queryKey => queryClient.invalidateQueries({ queryKey })),
      );
    },
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
          className="max-h-48 min-h-7 flex-1 resize-none bg-transparent px-2 py-1 text-body text-fg outline-none field-sizing-content placeholder:text-fg-muted focus-visible:shadow-none"
        />
        <Button
          type="submit"
          size="icon-small"
          className="max-sm:size-8"
          aria-disabled={isUnavailable || undefined}
        >
          {isBusy ? (
            <Loader aria-hidden="true" className="spin-in-place size-3.5" />
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
