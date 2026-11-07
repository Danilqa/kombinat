import type { HttpClient } from 'utils/http';

import { daemonStatusSchema } from './schemas';
import type { DaemonStatus } from './types';

export async function getDaemonStatus(http: HttpClient): Promise<DaemonStatus> {
  return http.request('/api/status', daemonStatusSchema);
}
