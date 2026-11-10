export function getWebhookPath(name: string): string {
  return `/api/routines/${encodeURIComponent(name)}/webhook`;
}
