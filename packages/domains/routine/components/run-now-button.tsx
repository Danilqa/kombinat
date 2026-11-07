import { useState } from 'react';
import { Play } from 'lucide-react';

import { Button } from 'design-system/components/button';
import { getErrorMessage } from 'utils/error';
import { sameOriginApi } from 'utils/http';

import { startRoutineRun } from '../requests';

type RunNowVariant = 'primary' | 'secondary';

interface RunNowButtonProps {
  routine: string;
  isRunning: boolean;
  onStarted: () => void;
  variant?: RunNowVariant;
}

export function RunNowButton({
  routine,
  isRunning,
  onStarted,
  variant = 'primary',
}: RunNowButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // aria-disabled instead of disabled keeps keyboard focus on the button after it is pressed.
  const isUnavailable = isRunning || isStarting;

  async function startRun() {
    if (isUnavailable) return;
    setIsStarting(true);
    setError(null);
    setAnnouncement('');
    try {
      await startRoutineRun(sameOriginApi, routine);
      setAnnouncement(`Started a run of ${routine}`);
      onStarted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span role="status" className="sr-only">
        {announcement}
      </span>
      {error && (
        <span role="alert" className="max-w-56 truncate text-body-sm text-negative" title={error}>
          {error}
        </span>
      )}
      <Button
        variant={variant}
        size="small"
        aria-disabled={isUnavailable || undefined}
        onClick={() => void startRun()}
      >
        <Play aria-hidden="true" className="size-3.5 fill-current" />
        {isRunning ? 'Running' : 'Run now'}
        <span className="sr-only"> {routine}</span>
      </Button>
    </div>
  );
}
