import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from 'design-system';

const meta = {
  title: 'Components/Spinner',
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Coloured: Story = {
  args: { className: 'w-8 text-info' },
};
