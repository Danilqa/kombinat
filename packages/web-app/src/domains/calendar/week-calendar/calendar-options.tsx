import { Ellipsis } from 'lucide-react';
import { Button, DropdownMenu } from 'design-system';

interface CalendarOptionsProps {
  isHighlightingOverlaps: boolean;
  overlapCount: number | null;
  onHighlightOverlapsChange: (isHighlighting: boolean) => void;
}

export function CalendarOptions({
  isHighlightingOverlaps,
  overlapCount,
  onHighlightOverlapsChange,
}: CalendarOptionsProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="tertiary" size="icon-small" aria-label="Calendar options">
          <Ellipsis className="transition-transform duration-200 ease-out-quint group-data-[state=open]/button:rotate-90" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.CheckboxItem
          checked={isHighlightingOverlaps}
          onCheckedChange={onHighlightOverlapsChange}
        >
          Highlight overlaps
          {overlapCount !== null && (
            <span className="ml-auto pl-6 text-fg-muted tabular-nums">
              {overlapCount} this week
            </span>
          )}
        </DropdownMenu.CheckboxItem>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
