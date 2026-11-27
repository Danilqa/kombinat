import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from 'design-system';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  args: { children: 'No runs yet' },
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
