import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import * as Popover from './popover';

const meta = {
  title: 'Components/Popover',
  component: Popover.Root,
  subcomponents: {
    'Popover.Trigger': Popover.Trigger,
    'Popover.Anchor': Popover.Anchor,
    'Popover.Content': Popover.Content,
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Popover.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => (
    <Popover.Root {...args}>
      <Popover.Trigger asChild>
        <Button variant="secondary" size="small">
          3 queued
        </Button>
      </Popover.Trigger>
      <Popover.Content>
        The next runs start one after another once the current run ends.
      </Popover.Content>
    </Popover.Root>
  ),
};
