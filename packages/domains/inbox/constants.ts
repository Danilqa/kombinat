import { notifyLevelSchema } from './schemas';
import type { InboxGroup, NotifyLevel } from './types';

export const INBOX_GROUPS: InboxGroup[] = ['needs_look', 'findings', 'quiet'];

export const NOTIFY_LEVELS = notifyLevelSchema.options;

export const DEFAULT_NOTIFY_LEVEL: NotifyLevel = 'never';

// More runs than this at once, such as when a sleeping computer wakes up, make one notification.
export const MAX_RUN_NOTIFICATIONS = 3;
