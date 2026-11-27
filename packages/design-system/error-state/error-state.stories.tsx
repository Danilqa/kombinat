import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorState } from './error-state';

const meta = {
  title: 'Components/ErrorState',
  component: ErrorState,
  args: { message: 'The daemon is not running. Start it with kombinat serve.' },
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
