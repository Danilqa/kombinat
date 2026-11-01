import { useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startRoutineRun } from '@/lib/api';
import { getErrorMessage } from '@shared/errors';

interface RunNowButtonProps {
  routine: string;
  isRunning: boolean;
  onStarted: () => void;
}

export function RunNowButton({ routine, isRunning, onStarted }: RunNowButtonProps) {
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
        <span className="max-w-56 truncate text-paragraph-12 text-dark-red" title={error}>
          {error}
        </span>
      )}
      <Button
        variant="primary"
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
