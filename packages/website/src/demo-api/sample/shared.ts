import { accountNameSchema } from 'domains/agent/ids';

import { HOME } from '../constants';
import { init } from './steps';

export const REPO = `${HOME}/Projects/acme-web`;
export const WORK = accountNameSchema.parse('work');
export const PERSONAL = accountNameSchema.parse('personal');
export const OPUS = 'claude-opus-5-5';
export const SONNET = 'claude-sonnet-5-5';
export const FABLE = 'claude-fable-5-1';

export const opusInit = init({ model: OPUS, cwd: REPO, toolCount: 32, permissionMode: 'auto' });
export const sonnetInit = init({ model: SONNET, cwd: REPO, toolCount: 32, permissionMode: 'auto' });
export const fableInit = init({ model: FABLE, cwd: REPO, toolCount: 32, permissionMode: 'auto' });
export const codexInit = init({ model: null, cwd: null, toolCount: null, permissionMode: null });
