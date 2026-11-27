import type { Meta, StoryObj } from '@storybook/react-vite';
import { PingingStatusDot, StatusDot } from 'design-system';

const TONES = ['positive', 'negative', 'warning', 'info', 'ghost'] as const;

const meta = {
  title: 'Components/StatusDot',
  component: StatusDot,
  subcomponents: { PingingStatusDot },
  args: { tone: 'positive' },
  argTypes: { tone: { control: 'select', options: TONES } },
  decorators: [
    Story => (
      <div className="flex">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatusDot>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: () => (
    <ul className="space-y-2 text-body text-fg">
      {TONES.map(tone => (
        <li key={tone} className="flex items-center gap-2">
          <StatusDot tone={tone} />
          {tone}
        </li>
      ))}
    </ul>
  ),
};

export const Pinging: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-body text-fg">
      <PingingStatusDot tone="info" isPinging />
      Running
    </div>
  ),
};
