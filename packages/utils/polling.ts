const ACTIVE_POLL_MS = 5000;
const IDLE_POLL_MS = 15000;

export function getPollInterval(isActive: boolean): number {
  return isActive ? ACTIVE_POLL_MS : IDLE_POLL_MS;
}
