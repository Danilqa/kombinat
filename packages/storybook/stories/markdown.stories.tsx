import type { Meta, StoryObj } from '@storybook/react-vite';
import { Markdown } from 'design-system';

const SOURCE = `# Weekly report

Merged **12 pull requests** last week, 3 more than the week before.

## Highlights

- Faster cold start of the dashboard
- Retry runs that stop with an error
- \`kombinat validate\` reports unknown settings

| Area | Pull requests |
| ---- | ------------- |
| CLI  | 5             |
| Web  | 7             |

\`\`\`bash
pnpm kombinat run weekly-report
\`\`\`

Read the [changelog](https://kombinat.tech/changelog) for the rest.`;

const meta = {
  title: 'Components/Markdown',
  component: Markdown,
  args: { source: SOURCE, minHeadingLevel: 2 },
  argTypes: {
    minHeadingLevel: { control: 'inline-radio', options: [2, 3] },
  },
} satisfies Meta<typeof Markdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
