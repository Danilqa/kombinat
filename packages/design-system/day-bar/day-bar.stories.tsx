import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from '../card';
import { DayBar } from './day-bar';

const WEEK = [
  { day: 'Mon', succeeded: 8, failed: 1 },
  { day: 'Tue', succeeded: 12, failed: 0 },
  { day: 'Wed', succeeded: 5, failed: 3 },
  { day: 'Thu', succeeded: 0, failed: 0 },
  { day: 'Fri', succeeded: 14, failed: 2 },
  { day: 'Sat', succeeded: 3, failed: 0 },
  { day: 'Sun', succeeded: 6, failed: 1 },
];

const MAX_TOTAL = Math.max(...WEEK.map(({ succeeded, failed }) => succeeded + failed));

const meta = {
  title: 'Components/DayBar',
  component: DayBar,
  args: {
    label: 'Fri: 14 succeeded, 2 failed',
    segments: [
      { value: 14, className: 'bg-positive' },
      { value: 2, className: 'bg-negative' },
    ],
    maxTotal: 16,
    caption: 'Fri',
  },
  render: args => (
    <ol className="flex w-16">
      <DayBar {...args} />
    </ol>
  ),
} satisfies Meta<typeof DayBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { label: 'Thu: no runs', segments: [], caption: 'Thu' },
};

export const Week: Story = {
  decorators: [
    Story => (
      <Card.Root className="max-w-md p-4">
        <Story />
      </Card.Root>
    ),
  ],
  render: () => (
    <ol aria-label="Runs per day" className="flex gap-2">
      {WEEK.map(({ day, succeeded, failed }) => (
        <DayBar
          key={day}
          label={`${day}: ${succeeded} succeeded, ${failed} failed`}
          segments={[
            { value: succeeded, className: 'bg-positive' },
            { value: failed, className: 'bg-negative' },
          ]}
          maxTotal={MAX_TOTAL}
          caption={day}
          className="h-32"
        />
      ))}
    </ol>
  ),
};
