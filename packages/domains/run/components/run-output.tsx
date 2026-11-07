import { CodeBlock, Markdown, Separator } from 'design-system/components';

import type { RunRecord } from '../types';

interface RunOutputProps {
  run: RunRecord;
}

export function RunOutput({ run }: RunOutputProps) {
  return (
    <div className="space-y-4 p-4">
      {run.error && (
        <div>
          <div className="eyebrow mb-2">Error</div>
          <CodeBlock
            label="Run error"
            className="max-h-80 border-transparent bg-negative-soft text-negative"
          >
            {run.error}
          </CodeBlock>
        </div>
      )}
      {run.error && run.resultText && <Separator />}
      {run.resultText && (
        <div>
          <div className="eyebrow mb-2">Result</div>
          <Markdown source={run.resultText} minHeadingLevel={2} />
        </div>
      )}
    </div>
  );
}
