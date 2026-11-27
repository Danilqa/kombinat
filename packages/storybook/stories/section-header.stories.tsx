import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, SectionHeader } from 'design-system';

const meta = {
  title: 'Components/SectionHeader',
  component: SectionHeader.Root,
  subcomponents: { 'SectionHeader.Aside': SectionHeader.Aside },
  args: { children: 'Runs', aside: <SectionHeader.Aside>48 this week</SectionHeader.Aside> },
} satisfies Meta<typeof SectionHeader.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithContent: Story = {
  render: args => (
    <section className="max-w-xl">
      <SectionHeader.Root {...args} />
      <Card.Root className="p-4 text-body text-fg-prose">
        The header sticks while its section scrolls.
      </Card.Root>
    </section>
  ),
};
