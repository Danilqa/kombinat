import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import * as Tooltip from './tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip.Root,
  subcomponents: {
    'Tooltip.Provider': Tooltip.Provider,
    'Tooltip.Trigger': Tooltip.Trigger,
    'Tooltip.Content': Tooltip.Content,
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Tooltip.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => (
    <Tooltip.Root {...args}>
      <Tooltip.Trigger asChild>
        <Button variant="secondary" size="small">
          0 9 * * 1
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>Every Monday at 09:00</Tooltip.Content>
    </Tooltip.Root>
  ),
};

export const Open: Story = {
  ...Default,
  args: { defaultOpen: true },
};
