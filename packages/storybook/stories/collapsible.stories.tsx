import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Collapsible } from 'design-system';
import { ChevronDown } from 'lucide-react';

const meta = {
  title: 'Components/Collapsible',
  component: Collapsible.Root,
  subcomponents: {
    'Collapsible.Trigger': Collapsible.Trigger,
    'Collapsible.Content': Collapsible.Content,
  },
  args: { defaultOpen: false },
} satisfies Meta<typeof Collapsible.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => (
    <Collapsible.Root {...args} className="max-w-md">
      <Collapsible.Trigger asChild>
        <Button variant="tertiary" size="small" className="group">
          Show the steps
          <ChevronDown
            aria-hidden="true"
            className="transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <ol className="mt-2 list-decimal space-y-1 pl-8 text-body text-fg-prose">
          <li>Read the merged pull requests</li>
          <li>Group them by area</li>
          <li>Post the summary</li>
        </ol>
      </Collapsible.Content>
    </Collapsible.Root>
  ),
};

export const Open: Story = {
  ...Default,
  args: { defaultOpen: true },
};
