interface StatProps {
  label: string;
  value: string;
  note: string;
}

export function Stat({ label, value, note }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-body-sm text-fg-muted">{label}</dt>
      <dd className="space-y-0.5">
        <div className="text-title-sm font-medium text-fg tabular-nums">{value}</div>
        <div className="text-body-sm text-fg-muted">{note}</div>
      </dd>
    </div>
  );
}
