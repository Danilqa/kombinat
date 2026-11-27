import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Command, Kbd } from 'design-system';
import { FileText, Play } from 'lucide-react';
import { useState } from 'react';

const ROUTINES = ['weekly-report', 'dependency-updates', 'triage-issues'];
const RUNS = ['weekly-report #42', 'triage-issues #17'];

function CommandContent() {
  return (
    <>
      <Command.Input placeholder="Search routines and runs" />
      <Command.List>
        <Command.Empty>Nothing found</Command.Empty>
        <Command.Group heading="Routines">
          {ROUTINES.map(routine => (
            <Command.Item key={routine}>
              <FileText aria-hidden="true" />
              {routine}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Runs">
          {RUNS.map(run => (
            <Command.Item key={run}>
              <Play aria-hidden="true" />
              {run}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </>
  );
}

const meta = {
  title: 'Components/Command',
  component: Command.Root,
  subcomponents: {
    'Command.Dialog': Command.Dialog,
    'Command.Header': Command.Header,
    'Command.Input': Command.Input,
    'Command.List': Command.List,
    'Command.Empty': Command.Empty,
    'Command.Loading': Command.Loading,
    'Command.Group': Command.Group,
    'Command.Item': Command.Item,
  },
  args: { label: 'Search' },
} satisfies Meta<typeof Command.Root>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inline: Story = {
  render: args => (
    <Command.Root
      {...args}
      className="max-w-xl overflow-hidden rounded-xl border border-line bg-surface"
    >
      <CommandContent />
    </Command.Root>
  ),
};

export const Loading: Story = {
  render: args => (
    <Command.Root
      {...args}
      shouldFilter={false}
      className="max-w-xl overflow-hidden rounded-xl border border-line bg-surface"
    >
      <Command.Input placeholder="Search routines and runs" value="report" />
      <Command.List>
        <Command.Loading>Searching the runs…</Command.Loading>
      </Command.List>
    </Command.Root>
  ),
};

function CommandDialogDemo() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Search <Kbd>⌘K</Kbd>
      </Button>
      <Command.Dialog title="Search" open={isOpen} onOpenChange={setIsOpen}>
        <Command.Root label="Search">
          <CommandContent />
        </Command.Root>
      </Command.Dialog>
    </>
  );
}

export const Dialog: Story = {
  render: () => <CommandDialogDemo />,
};
