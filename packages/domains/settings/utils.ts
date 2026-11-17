import { match, P } from 'ts-pattern';

export function getRunRetentionLabel(days: number | null): string {
  return match(days)
    .with(null, () => 'Forever')
    .with(7, () => '1 week')
    .with(30, () => '1 month')
    .with(90, () => '3 months')
    .with(P.number, count => `${count} days`)
    .exhaustive();
}
