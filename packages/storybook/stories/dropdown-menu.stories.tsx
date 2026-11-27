import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, DropdownMenu } from 'design-system';
import { Copy, MoreHorizontal, Pause, Trash2 } from 'lucide-react';
import { useState } from 'react';

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu.Root,
  subcomponents: {
    'DropdownMenu.Trigger': DropdownMenu.Trigger,
    'DropdownMenu.Content': DropdownMenu.Content,
    'DropdownMenu.Group': DropdownMenu.Group,
    'DropdownMenu.Label': DropdownMenu.Label,
    'DropdownMenu.Item': DropdownMenu.Item,
    'DropdownMenu.CheckboxItem': DropdownMenu.CheckboxItem,
    'DropdownMenu.RadioGroup': DropdownMenu.RadioGroup,
    'DropdownMenu.RadioItem': DropdownMenu.RadioItem,
    'DropdownMenu.Separator': DropdownMenu.Separator,
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof DropdownMenu.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Actions: Story = {
  render: args => (
    <DropdownMenu.Root {...args}>
      <DropdownMenu.Trigger asChild>
        <Button variant="tertiary" size="icon-small" aria-label="Routine actions">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item>
          <Pause aria-hidden="true" />
          Pause
        </DropdownMenu.Item>
        <DropdownMenu.Item>
          <Copy aria-hidden="true" />
          Copy the file path
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item disabled>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  ),
};

function FiltersMenu() {
  const [isFailedOnly, setIsFailedOnly] = useState(false);
  const [agent, setAgent] = useState('all');
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="small">
          Filter
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.CheckboxItem checked={isFailedOnly} onCheckedChange={setIsFailedOnly}>
          Failed only
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Agent</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={agent} onValueChange={setAgent}>
          <DropdownMenu.RadioItem value="all">All agents</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="claude">Claude</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="codex">Codex</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export const Filters: Story = {
  render: () => <FiltersMenu />,
};
