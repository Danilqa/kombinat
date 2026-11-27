import type { Meta, StoryObj } from '@storybook/react-vite';
import { Kbd } from './kbd';

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
  args: { children: '⌘K' },
} satisfies Meta<typeof Kbd>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Shortcuts: Story = {
  render: () => (
    <dl className="grid w-fit grid-cols-[auto_auto] items-center gap-x-6 gap-y-2 text-body text-fg-secondary">
      <dt>Search</dt>
      <dd>
        <Kbd>⌘K</Kbd>
      </dd>
      <dt>Next day</dt>
      <dd>
        <Kbd>J</Kbd>
      </dd>
      <dt>Previous day</dt>
      <dd>
        <Kbd>K</Kbd>
      </dd>
      <dt>Today</dt>
      <dd>
        <Kbd>T</Kbd>
      </dd>
    </dl>
  ),
};
