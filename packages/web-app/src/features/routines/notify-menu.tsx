import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff } from 'lucide-react';
import { isMatching, match } from 'ts-pattern';

import { Button, DropdownMenu, Tooltip } from 'design-system/components';
import { DEFAULT_NOTIFY_LEVEL, NOTIFY_LEVELS } from 'domains/inbox/constants';
import { setNotifyLevel } from 'domains/inbox/requests';
import type { NotifyLevel } from 'domains/inbox/types';
import { getNotifyLevelLabel, getNotifyLevelShortLabel } from 'domains/inbox/utils';
import type { RoutineName } from 'domains/routine/ids';
import { sameOriginApi } from 'utils/http';
import { useInbox } from '@web-app/hooks/use-inbox';
import {
  useNotificationPermission,
  type NotificationAccess,
} from '@web-app/hooks/use-notification-permission';

function getAccessNote(access: NotificationAccess): string {
  return match(access)
    .with(
      'default',
      'granted',
      () =>
        'Runs are grouped as in the Inbox. Notifications come while the dashboard is open, in a tab or as the app.',
    )
    .with('denied', () => 'This browser blocks notifications. Allow them in its site settings.')
    .with(
      'insecure',
      () => 'Browsers show notifications only on localhost or HTTPS. Open the dashboard there.',
    )
    .with(
      'unsupported',
      () =>
        "This browser can't show notifications. On iPhone, add the dashboard to the Home Screen first.",
    )
    .exhaustive();
}

interface NotifyMenuProps {
  routine: RoutineName;
}

export function NotifyMenu({ routine }: NotifyMenuProps) {
  const queryClient = useQueryClient();
  const { data } = useInbox();
  const [access, requestPermission] = useNotificationPermission();
  const { mutate, error, isPending, variables, reset } = useMutation({
    mutationFn: (level: NotifyLevel) => setNotifyLevel(sameOriginApi, routine, level),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  });
  const level = isPending ? variables : (data?.notify[routine] ?? DEFAULT_NOTIFY_LEVEL);
  const isOn = !isMatching('never', level);
  const isShown = isOn && isMatching('granted', access);

  function changeLevel(value: string) {
    const next = NOTIFY_LEVELS.find(option => option === value);
    if (next === undefined) return;
    mutate(next);
    if (!isMatching('never', next)) void requestPermission();
  }

  // The row has no room for a message on phones, so it points at the menu instead.
  return (
    <Tooltip.Root
      open={error !== null}
      onOpenChange={isOpen => {
        if (!isOpen) reset();
      }}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Tooltip.Trigger asChild>
            {/* Phones have room for the icon only, with a 44px tap area that keeps the row as tall. */}
            <Button
              variant="tertiary"
              size="small"
              isActive={isOn}
              className="relative max-sm:size-7 max-sm:px-0 max-sm:after:absolute max-sm:after:-inset-2"
            >
              {isShown ? <Bell aria-hidden="true" /> : <BellOff aria-hidden="true" />}
              <span className="max-sm:sr-only">Notify: {getNotifyLevelShortLabel(level)}</span>
              <span className="sr-only"> for {routine}</span>
            </Button>
          </Tooltip.Trigger>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="w-64">
          <DropdownMenu.Label>Notify me about</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={level} onValueChange={changeLevel}>
            {NOTIFY_LEVELS.map(option => (
              <DropdownMenu.RadioItem key={option} value={option}>
                {getNotifyLevelLabel(option)}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          {isOn && isMatching('default', access) && (
            <>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onSelect={() => void requestPermission()}>
                <Bell aria-hidden="true" />
                Allow in this browser
              </DropdownMenu.Item>
            </>
          )}
          <p className="px-2.5 pt-1 pb-1.5 text-caption font-normal text-fg-muted">
            {getAccessNote(access)}
          </p>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <Tooltip.Content role="alert" collisionPadding={8} className="max-w-64 text-negative">
        {error?.message}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}
