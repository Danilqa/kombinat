import type { Meta, StoryObj } from '@storybook/react-vite';
import { RelativeTime } from 'design-system';

const MINUTE_MS = 60_000;

function getIsoAgo(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE_MS).toISOString();
}

const meta = {
  title: 'Components/RelativeTime',
  component: RelativeTime,
  args: { iso: getIsoAgo(5), isFocusable: true },
} satisfies Meta<typeof RelativeTime>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Earlier: Story = {
  render: args => (
    <ul className="space-y-1 text-body text-fg">
      {[0, 3, 90, 60 * 26, 60 * 24 * 40].map(minutes => (
        <li key={minutes}>
          <RelativeTime {...args} iso={getIsoAgo(minutes)} />
        </li>
      ))}
    </ul>
  ),
};

export const Missing: Story = {
  args: { iso: null },
};
