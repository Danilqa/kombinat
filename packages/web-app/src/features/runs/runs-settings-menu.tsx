import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';

import { Button, DropdownMenu } from 'design-system/components';
import { RUN_RETENTION_DAYS_OPTIONS } from 'domains/settings/constants';
import { getSettings, updateSettings } from 'domains/settings/requests';
import { getRunRetentionLabel } from 'domains/settings/utils';
import { sameOriginApi } from 'utils/http';

const QUERY_KEYS_CHANGED_BY_CLEANUP = [['runs'], ['routines'], ['calendar']];

const toOptionValue = (days: number | null): string => (days === null ? 'forever' : String(days));

export function RunsSettingsMenu() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => getSettings(sameOriginApi),
  });
  const { mutate, error } = useMutation({
    mutationFn: (runRetentionDays: number | null) =>
      updateSettings(sameOriginApi, { runRetentionDays }),
    onSuccess: settings => {
      queryClient.setQueryData(['settings'], settings);
      return Promise.all(
        QUERY_KEYS_CHANGED_BY_CLEANUP.map(queryKey => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });

  function changeRetention(value: string) {
    const days = RUN_RETENTION_DAYS_OPTIONS.find(option => toOptionValue(option) === value);
    if (days !== undefined) mutate(days);
  }

  return (
    <>
      {error && (
        <span
          role="alert"
          className="max-w-56 animate-in truncate text-body-sm text-negative duration-200 fade-in"
          title={error.message}
        >
          {error.message}
        </span>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          {/* A 44px tap area on phones that keeps the header row as tall as the run count. */}
          <Button
            variant="tertiary"
            size="icon-small"
            className="relative max-sm:after:absolute max-sm:after:-inset-2"
            aria-label="Settings"
          >
            <Settings className="transition-transform duration-300 ease-out-quint group-data-[state=open]/button:rotate-45" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="w-56">
          <DropdownMenu.Label>Keep runs for</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={data ? toOptionValue(data.runRetentionDays) : ''}
            onValueChange={changeRetention}
          >
            {RUN_RETENTION_DAYS_OPTIONS.map(days => (
              <DropdownMenu.RadioItem key={toOptionValue(days)} value={toOptionValue(days)}>
                {getRunRetentionLabel(days)}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <p className="px-2.5 pt-1 pb-1.5 text-caption font-normal text-fg-muted">
            Older runs and webhook calls are deleted, except the last run of each routine.
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </>
  );
}
