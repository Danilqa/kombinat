import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Loader, ShieldAlert } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { isMatching } from 'ts-pattern';

import { Button } from 'design-system/components';
import { sameOriginApi } from 'utils/http';

import { getAgentLabel } from '../../agent/utils';
import { QUERY_KEYS_CHANGED_BY_ALLOW } from '../constants';
import { allowBlockedActions } from '../requests';
import type { BlockedAction, RunRecord } from '../types';
import {
  checkCanContinueRun,
  checkIsRunActive,
  getWorktreeBaseStep,
  listBlockedRules,
} from '../utils';

const COPIED_MS = 1500;
const VISIBLE_ACTIONS = 5;

function useCopyText(text: string): [boolean, () => void] {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) return;
    const timeout = setTimeout(() => setIsCopied(false), COPIED_MS);
    return () => clearTimeout(timeout);
  }, [isCopied]);

  function copy() {
    navigator.clipboard.writeText(text).then(
      () => setIsCopied(true),
      () => undefined,
    );
  }

  return [isCopied, copy];
}

interface AllowRuleProps {
  rule: string;
}

function AllowRule({ rule }: AllowRuleProps) {
  const [isCopied, copy] = useCopyText(rule);
  return (
    <span className="flex max-w-full min-w-0 items-center gap-0.5">
      <code className="min-w-0 rounded-md bg-warning-soft px-1.5 py-0.5 font-mono text-caption break-all text-warning">
        {rule}
      </code>
      <Button
        variant="tertiary"
        size="icon-small"
        className="shrink-0 max-sm:size-9"
        aria-label={isCopied ? 'Copied' : `Copy the rule ${rule}`}
        title="Copy rule"
        onClick={copy}
      >
        {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
    </span>
  );
}

interface BlockedActionRowProps {
  action: BlockedAction;
}

function BlockedActionRow({ action }: BlockedActionRowProps) {
  return (
    <li className="flex flex-col gap-1.5 py-2.5 pr-1.5 pl-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-caption text-fg-muted">{action.tool}</p>
        <p className="line-clamp-2 font-mono text-body-sm break-all text-fg" title={action.preview}>
          {action.preview}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:max-w-1/2 sm:justify-end">
        {action.rules.map(rule => (
          <AllowRule key={rule} rule={rule} />
        ))}
      </div>
    </li>
  );
}

interface BlockedActionsCardProps {
  run: RunRecord;
  // The folder whose .claude/settings.json allows the rules, in the checkout for a worktree run.
  cwd: string | null;
  onAllowed: () => void;
}

export function BlockedActionsCard({ run, cwd, onAllowed }: BlockedActionsCardProps) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const actions = run.blockedActions;
  const rules = listBlockedRules(actions);
  const [isCopied, copyAll] = useCopyText(rules.map(rule => `"${rule}"`).join(',\n'));
  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: () => allowBlockedActions(sameOriginApi, run.routine, run.id),
    onSuccess: () => {
      onAllowed();
      return Promise.all(
        QUERY_KEYS_CHANGED_BY_ALLOW.map(queryKey => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
  const isOne = actions.length === 1;
  const hasOneRule = rules.length === 1;
  const isRunActive = checkIsRunActive(run);
  // A reply that fails leaves the actions on the run, so the card offers to allow them again.
  const isContinuing = isPending || (isSuccess && isRunActive);
  const isBusy = isContinuing || isRunActive;
  const visible = isExpanded ? actions : actions.slice(0, VISIBLE_ACTIONS);
  const hiddenCount = actions.length - visible.length;
  const settingsPath = cwd === null ? '.claude/settings.json' : `${cwd}/.claude/settings.json`;
  const baseStep = run.worktree === null ? null : getWorktreeBaseStep(run.worktree);

  function allow() {
    if (!isBusy) mutate();
  }

  return (
    <section
      aria-labelledby={titleId}
      className="mb-6 rounded-xl border border-warning/30 bg-surface p-4 sm:p-5"
    >
      <h2 id={titleId} className="flex items-start gap-2 text-body font-medium text-fg">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        {isOne ? '1 action was blocked' : `${actions.length} actions were blocked`}
      </h2>
      <p className="mt-1 text-body-sm text-fg-muted sm:pl-6">
        Nobody was there to approve {isOne ? 'it' : 'them'}, and {getAgentLabel(run.agent)} went on
        without {isOne ? 'it' : 'them'}.
        {isMatching('succeeded', run.status) && ' The run still counts as succeeded.'}
      </p>
      <ul className="mt-4 divide-y divide-line-faint rounded-lg border border-line-faint sm:ml-6">
        {visible.map(action => (
          <BlockedActionRow key={`${action.tool}\n${action.preview}`} action={action} />
        ))}
      </ul>
      {hiddenCount > 0 && (
        <Button
          variant="tertiary"
          size="small"
          className="mt-2 max-sm:h-9 sm:ml-6"
          onClick={() => setIsExpanded(true)}
        >
          Show {hiddenCount} more
        </Button>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:pl-6">
        <div className="flex items-center gap-2">
          {checkCanContinueRun(run) && (
            <Button
              variant="secondary"
              size="small"
              className="max-sm:h-9"
              aria-disabled={isBusy || undefined}
              onClick={allow}
            >
              {isContinuing && <Loader aria-hidden="true" className="spin-in-place size-3.5" />}
              {isContinuing ? 'Continuing…' : 'Allow and continue'}
            </Button>
          )}
          <Button variant="tertiary" size="small" className="max-sm:h-9" onClick={copyAll}>
            {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {isCopied ? 'Copied' : hasOneRule ? 'Copy the rule' : 'Copy all rules'}
          </Button>
        </div>
        <p className="text-caption text-fg-muted">
          To allow {isOne ? 'it' : 'them'} in every run, add {hasOneRule ? 'the rule' : 'the rules'}{' '}
          to <code className="font-mono text-fg-secondary">permissions.allow</code> in{' '}
          <code className="font-mono break-all text-fg-secondary">{settingsPath}</code>
          {baseStep !== null &&
            (baseStep.branch === null ? (
              " and commit the change. Each run's worktree starts from the checkout's current commit."
            ) : (
              <>
                {' '}
                and {baseStep.verb} the change to{' '}
                <code className="font-mono break-all text-fg-secondary">{baseStep.branch}</code>.
                Each run's worktree starts from there.
              </>
            ))}
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-3 animate-in text-body-sm text-negative duration-200 fade-in sm:pl-6"
        >
          {error.message}
        </p>
      )}
    </section>
  );
}
