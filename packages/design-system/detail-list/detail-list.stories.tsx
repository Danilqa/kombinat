import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../badge';
import { Card } from '../card';
import { DetailList } from './detail-list';

const meta = {
  title: 'Components/DetailList',
  component: DetailList,
  args: {
    entries: [
      { label: 'Status', value: <Badge variant="positive">Succeeded</Badge> },
      { label: 'Agent', value: 'claude' },
      { label: 'Duration', value: '2m 14s' },
      { label: 'Tokens', value: '48,210' },
      { label: 'Schedule', value: '0 9 * * 1', isMono: true, span: 'wide' },
      { label: 'File', value: 'routines/weekly-report.md', isMono: true, span: 'wide' },
      {
        label: 'Working directory',
        value: '/Users/me/code/acme-web',
        isMono: true,
        span: 'full',
      },
    ],
  },
  decorators: [
    Story => (
      <Card.Root className="max-w-3xl">
        <Story />
      </Card.Root>
    ),
  ],
} satisfies Meta<typeof DetailList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
