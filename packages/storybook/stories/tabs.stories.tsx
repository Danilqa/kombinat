import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Tabs } from 'design-system';

const meta = {
  title: 'Components/Tabs',
  component: Tabs.Root,
  subcomponents: {
    'Tabs.List': Tabs.List,
    'Tabs.Trigger': Tabs.Trigger,
    'Tabs.Content': Tabs.Content,
  },
  args: { defaultValue: 'runs', orientation: 'horizontal' },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
} satisfies Meta<typeof Tabs.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: args => (
    <Tabs.Root {...args}>
      <Tabs.List>
        <Tabs.Trigger value="runs">Runs</Tabs.Trigger>
        <Tabs.Trigger value="prompt">Prompt</Tabs.Trigger>
        <Tabs.Trigger value="memory">
          Memory
          <Badge size="small">3</Badge>
        </Tabs.Trigger>
        <Tabs.Trigger value="settings" disabled>
          Settings
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="runs" className="text-body text-fg-prose">
        The runs of this routine, newest first.
      </Tabs.Content>
      <Tabs.Content value="prompt" className="text-body text-fg-prose">
        The prompt the agent gets on every run.
      </Tabs.Content>
      <Tabs.Content value="memory" className="text-body text-fg-prose">
        Notes that carry over from one run to the next.
      </Tabs.Content>
    </Tabs.Root>
  ),
};

export const Vertical: Story = {
  ...Default,
  args: { orientation: 'vertical' },
};
