import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'design-system';
import { MoreHorizontal, Play } from 'lucide-react';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: {
    children: 'Run now',
    variant: 'primary',
    size: 'medium',
    isActive: false,
    isGlass: false,
    disabled: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'tertiary'] },
    size: { control: 'inline-radio', options: ['small', 'medium', 'icon-small'] },
    isActive: { control: 'boolean' },
    isGlass: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: args => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="tertiary">
        Tertiary
      </Button>
    </div>
  ),
};

export const Small: Story = {
  ...Variants,
  args: { size: 'small' },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Play aria-hidden="true" />
        Run now
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    variant: 'tertiary',
    size: 'icon-small',
    'aria-label': 'More actions',
    children: <MoreHorizontal aria-hidden="true" />,
  },
};

export const ActiveTertiary: Story = {
  args: { variant: 'tertiary', isActive: true, children: 'Runs' },
};

export const Glass: Story = {
  args: { variant: 'secondary', isGlass: true, children: 'Star on GitHub' },
};

export const Disabled: Story = {
  ...Variants,
  args: { disabled: true },
};

export const AriaDisabled: Story = {
  ...Variants,
  args: { 'aria-disabled': true },
};
