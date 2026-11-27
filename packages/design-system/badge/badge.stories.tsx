import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './badge';
import { Webhook } from 'lucide-react';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Succeeded', variant: 'positive', size: 'medium' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['positive', 'neutral', 'info', 'warning', 'negative', 'ghost'],
    },
    size: { control: 'inline-radio', options: ['medium', 'small'] },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: args => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge {...args} variant="positive">
        Succeeded
      </Badge>
      <Badge {...args} variant="neutral">
        Queued
      </Badge>
      <Badge {...args} variant="info">
        Running
      </Badge>
      <Badge {...args} variant="warning">
        Skipped
      </Badge>
      <Badge {...args} variant="negative">
        Failed
      </Badge>
      <Badge {...args} variant="ghost">
        Paused
      </Badge>
    </div>
  ),
};

export const Small: Story = {
  ...Variants,
  args: { size: 'small' },
};

export const WithIcon: Story = {
  args: {
    variant: 'neutral',
    children: (
      <>
        <Webhook aria-hidden="true" />
        Webhook
      </>
    ),
  },
};
