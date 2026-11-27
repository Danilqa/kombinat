import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, Button, Card } from 'design-system';

const meta = {
  title: 'Components/Card',
  component: Card.Root,
  subcomponents: {
    'Card.Header': Card.Header,
    'Card.Title': Card.Title,
    'Card.Description': Card.Description,
    'Card.Action': Card.Action,
    'Card.Content': Card.Content,
    'Card.Footer': Card.Footer,
  },
} satisfies Meta<typeof Card.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card.Root className="max-w-md gap-4 py-6">
      <Card.Header>
        <Card.Title>Weekly report</Card.Title>
        <Card.Description>Every Monday at 09:00</Card.Description>
        <Card.Action>
          <Badge variant="positive">Active</Badge>
        </Card.Action>
      </Card.Header>
      <Card.Content className="text-body text-fg-prose">
        Sums up the merged pull requests of the week and posts them to the team channel.
      </Card.Content>
      <Card.Footer className="justify-end gap-2">
        <Button variant="tertiary" size="small">
          Pause
        </Button>
        <Button size="small">Run now</Button>
      </Card.Footer>
    </Card.Root>
  ),
};

export const Plain: Story = {
  render: () => (
    <Card.Root className="max-w-md p-4 text-body text-fg-prose">
      Card.Root has no padding or gap of its own.
    </Card.Root>
  ),
};
