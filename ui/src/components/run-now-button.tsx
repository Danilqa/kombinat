import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startRoutineRun } from '@/lib/api';
import { getErrorMessage } from '@shared/errors';

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

  async function startRun() {
    setIsStarting(true);
    setError(null);
    try {
      await startRoutineRun(routine);
      onStarted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span className="max-w-56 truncate text-body-sm text-negative" title={error}>
          {error}
        </span>
      )}
      <Button
        variant={variant}
        size="small"
        disabled={isRunning || isStarting}
        onClick={() => void startRun()}
      >
        <Play className="size-3.5 fill-current" />
        {isRunning ? 'Running' : 'Run now'}
      </Button>
    </div>
  );
}
