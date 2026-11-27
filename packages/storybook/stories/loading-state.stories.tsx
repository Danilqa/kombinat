import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoadingState } from 'design-system';

const meta = {
  title: 'Components/LoadingState',
  component: LoadingState,
} satisfies Meta<typeof LoadingState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
