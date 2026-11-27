import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, type BadgeVariant } from '../badge';
import * as Table from './table';
import { useState } from 'react';

interface Run {
  id: number;
  routine: string;
  status: string;
  variant: BadgeVariant;
  duration: string;
}

const STATUSES = [
  { status: 'Succeeded', variant: 'positive' },
  { status: 'Failed', variant: 'negative' },
  { status: 'Skipped', variant: 'warning' },
] as const;

const ROUTINES = ['weekly-report', 'dependency-updates', 'triage-issues', 'release-notes'];

function buildRuns(count: number): Run[] {
  return Array.from({ length: count }, (_, index) => {
    const { status, variant } = STATUSES[index % 3 === 2 ? index % 2 : 0] ?? STATUSES[0];
    return {
      id: count - index,
      routine: ROUTINES[index % ROUTINES.length] ?? 'weekly-report',
      status,
      variant,
      duration: `${(index % 5) + 1}m ${(index * 7) % 60}s`,
    };
  });
}

function RunCells({ run }: RunCellsProps) {
  return (
    <>
      <Table.Cell className="font-mono text-body-sm text-fg-muted">#{run.id}</Table.Cell>
      <Table.Cell>{run.routine}</Table.Cell>
      <Table.Cell>
        <Badge variant={run.variant}>{run.status}</Badge>
      </Table.Cell>
      <Table.Cell className="text-right text-fg-secondary">{run.duration}</Table.Cell>
    </>
  );
}

interface RunCellsProps {
  run: Run;
}

const meta = {
  title: 'Components/Table',
  component: Table.Root,
  subcomponents: {
    'Table.Header': Table.Header,
    'Table.Body': Table.Body,
    'Table.Footer': Table.Footer,
    'Table.Row': Table.Row,
    'Table.Head': Table.Head,
    'Table.Cell': Table.Cell,
    'Table.Caption': Table.Caption,
  },
} satisfies Meta<typeof Table.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => (
    <div className="rounded-xl border border-line bg-surface">
      <Table.Root {...args}>
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-20">Run</Table.Head>
            <Table.Head>Routine</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head className="text-right">Duration</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {buildRuns(6).map(run => (
            <Table.Row key={run.id}>
              <RunCells run={run} />
            </Table.Row>
          ))}
        </Table.Body>
        <Table.Footer>
          <Table.Row>
            <Table.Cell colSpan={3}>6 runs</Table.Cell>
            <Table.Cell className="text-right">14m 30s</Table.Cell>
          </Table.Row>
        </Table.Footer>
        <Table.Caption>The last runs of every routine</Table.Caption>
      </Table.Root>
    </div>
  ),
};

const PAGE_SIZE = 50;
const TOTAL_RUNS = 500;
const ALL_RUNS = buildRuns(TOTAL_RUNS);

function VirtualTableDemo() {
  const [count, setCount] = useState(PAGE_SIZE);
  return (
    <div className="rounded-xl border border-line bg-surface">
      <Table.VirtualRoot
        data={ALL_RUNS.slice(0, count)}
        totalCount={TOTAL_RUNS}
        header={
          <Table.Row>
            <Table.Head className="w-[15%]">Run</Table.Head>
            <Table.Head className="w-[40%]">Routine</Table.Head>
            <Table.Head className="w-[25%]">Status</Table.Head>
            <Table.Head className="w-[20%] text-right">Duration</Table.Head>
          </Table.Row>
        }
        computeItemKey={run => run.id}
        renderCells={run => <RunCells run={run} />}
        getRowProps={() => ({})}
        onEndReached={() => setCount(current => Math.min(current + PAGE_SIZE, TOTAL_RUNS))}
      />
    </div>
  );
}

export const Virtual: Story = {
  render: () => <VirtualTableDemo />,
};
