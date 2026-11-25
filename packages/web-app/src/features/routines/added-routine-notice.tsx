import { Badge } from 'design-system/components';

interface AddedRoutineNoticeProps {
  file: string;
}

export function AddedRoutineNotice({ file }: AddedRoutineNoticeProps) {
  return (
    <div
      role="status"
      className="mb-6 flex animate-in flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-4 py-3 text-body-sm duration-200 fade-in"
    >
      <Badge size="small" variant="info">
        New
      </Badge>
      <span className="text-fg">Added from a template. Commit it to keep it in git:</span>
      <code className="font-mono break-all text-fg-muted">git add {file}</code>
    </div>
  );
}
