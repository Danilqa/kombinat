import { CodeBlock } from 'design-system/components/code-block';
import { Markdown } from 'design-system/components/markdown';
import { Separator } from 'design-system/components/separator';

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
