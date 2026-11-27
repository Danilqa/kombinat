import type { Meta, StoryObj } from '@storybook/react-vite';
import { Separator } from 'design-system';

const meta = {
  title: 'Components/Separator',
  component: Separator,
  args: { orientation: 'horizontal' },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: args => (
    <div className="max-w-sm space-y-3 text-body text-fg">
      <p>Routines</p>
      <Separator {...args} />
      <p>Runs</p>
    </div>
  ),
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: args => (
    <div className="flex h-5 items-center gap-3 text-body text-fg">
      <span>Routines</span>
      <Separator {...args} />
      <span>Runs</span>
      <Separator {...args} />
      <span>Inbox</span>
    </div>
  ),
};
