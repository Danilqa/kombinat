import { PencilLine } from 'lucide-react';
import { Link } from 'react-router';
import { DropdownMenu } from 'design-system/components';
import type { RoutineName } from 'domains/routine/ids';
import { getRoutineRunPath } from '@web-app/constants/path';

interface ChangePromptMenuItemProps {
  routine: RoutineName;
}

export function ChangePromptMenuItem({ routine }: ChangePromptMenuItemProps) {
  return (
    <DropdownMenu.Item asChild>
      <Link to={getRoutineRunPath(routine)}>
        <PencilLine aria-hidden="true" />
        Change prompt and run
      </Link>
    </DropdownMenu.Item>
  );
}
