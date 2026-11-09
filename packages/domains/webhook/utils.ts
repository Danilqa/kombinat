export function getWebhookPath(routine: string): string {
  return `/api/routines/${encodeURIComponent(routine)}/webhook`;
}

export function formatPayloadSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function getQueuePositionLabel(index: number): string {
  return index === 0 ? 'Next' : `#${index + 1}`;
}
