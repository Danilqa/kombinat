import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import * as PageHeader from './page-header';
import { Plus } from 'lucide-react';

const meta = {
  title: 'Components/PageHeader',
  component: PageHeader.Root,
  subcomponents: {
    'PageHeader.Bar': PageHeader.Bar,
    'PageHeader.Title': PageHeader.Title,
    'PageHeader.Aside': PageHeader.Aside,
  },
  args: { title: 'Routines', count: 12 },
} satisfies Meta<typeof PageHeader.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAside: Story = {
  args: {
    aside: (
      <Button size="small">
        <Plus aria-hidden="true" />
        New routine
      </Button>
    ),
  },
};

export const Custom: Story = {
  render: () => (
    <PageHeader.Bar>
      <div className="flex items-center gap-2">
        <PageHeader.Title>weekly-report</PageHeader.Title>
        <PageHeader.Aside>#42</PageHeader.Aside>
      </div>
    </PageHeader.Bar>
  ),
};
