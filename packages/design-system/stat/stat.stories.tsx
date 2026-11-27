import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stat } from './stat';

const meta = {
  title: 'Components/Stat',
  component: Stat,
  args: { label: 'Used', value: '1.2M', note: 'tokens this week' },
  decorators: [
    Story => (
      <dl className="grid w-fit grid-cols-3 gap-6">
        <Story />
      </dl>
    ),
  ],
} satisfies Meta<typeof Stat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Row: Story = {
  render: () => (
    <>
      <Stat label="Used" value="1.2M" note="tokens this week" />
      <Stat label="Runs" value="48" note="6 failed" />
      <Stat label="Share" value="31%" note="of all routines" />
    </>
  ),
};
