import { routineNameSchema } from 'domains/routine/ids';

import { HOME } from '../../constants';
import { text } from '../steps';
import type { DemoRoutine } from '../types';

export const notesBackup: DemoRoutine = {
  name: routineNameSchema.parse('notes-backup'),
  description: 'Copies my notes to the backup drive',
  schedule: '30 23 * * *',
  enabled: true,
  agent: 'command',
  model: null,
  effort: null,
  permissionMode: null,
  command: 'rsync -a --delete --stats ~/Notes/ /Volumes/Backup/Notes/ | tail -n 4',
  cwd: HOME,
  timeoutMinutes: 10,
  maxBudgetUsd: null,
  prompt: 'Back up ~/Notes to the external drive.',
  runModel: null,
  outcomes: [
    {
      id: 'synced',
      weight: 1,
      status: 'succeeded',
      minutes: 0.3,
      resultText: `Number of regular files transferred: 12
Total transferred file size: 184,330 bytes
sent 201,887 bytes  received 1,106 bytes  135,328.67 bytes/sec
total size is 48,213,904  speedup is 237.52`,
      steps: [
        text(`Number of regular files transferred: 12
Total transferred file size: 184,330 bytes
sent 201,887 bytes  received 1,106 bytes  135,328.67 bytes/sec
total size is 48,213,904  speedup is 237.52`),
      ],
    },
    {
      id: 'drive-missing',
      weight: 0,
      status: 'failed',
      minutes: 0.1,
      exitCode: 23,
      error: `rsync: change_dir#3 "/Volumes/Backup/Notes" failed: No such file or directory (2)
rsync error: some files/attrs were not transferred (see previous errors) (code 23)`,
      steps: [],
    },
  ],
  pins: [{ slotsAgo: 3, outcome: 'drive-missing' }],
};
