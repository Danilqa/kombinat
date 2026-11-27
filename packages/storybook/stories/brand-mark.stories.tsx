import type { Meta, StoryObj } from '@storybook/react-vite';
import { BrandMark } from 'design-system';

const meta = {
  title: 'Components/BrandMark',
  component: BrandMark,
} satisfies Meta<typeof BrandMark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: { className: 'size-16' },
};

export const WithName: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-title-md text-fg">
      <BrandMark />
      Kombinat
    </div>
  ),
};
