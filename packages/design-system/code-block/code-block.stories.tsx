import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeBlock } from './code-block';

const PROMPT = `---
schedule: 0 9 * * 1
agent: claude
---

Sum up the pull requests merged last week and post them to #team.`;

const meta = {
  title: 'Components/CodeBlock',
  component: CodeBlock,
  args: { label: 'Prompt', children: PROMPT },
} satisfies Meta<typeof CodeBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const HeightCapped: Story = {
  args: {
    label: 'Output',
    className: 'max-h-32',
    children: Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join('\n'),
  },
};
