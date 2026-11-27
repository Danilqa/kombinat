import type { Meta, StoryObj } from '@storybook/react-vite';

interface TextStyle {
  name: string;
  className: string;
}

const TEXT_STYLES: TextStyle[] = [
  { name: 'title-lg', className: 'text-title-lg' },
  { name: 'title-md', className: 'text-title-md' },
  { name: 'title-sm', className: 'text-title-sm' },
  { name: 'body', className: 'text-body' },
  { name: 'body-sm', className: 'text-body-sm' },
  { name: 'caption', className: 'text-caption' },
  { name: 'nav', className: 'text-nav' },
  { name: 'nav-sm', className: 'text-nav-sm' },
  { name: 'eyebrow', className: 'eyebrow' },
];

function TypeScale() {
  return (
    <dl className="grid grid-cols-[8rem_1fr] items-baseline gap-x-6 gap-y-4">
      {TEXT_STYLES.map(style => (
        <div key={style.name} className="contents">
          <dt className="font-mono text-body-sm text-fg-muted">{style.name}</dt>
          <dd className={`text-fg ${style.className}`}>Run agents on a schedule or webhook</dd>
        </div>
      ))}
      <div className="contents">
        <dt className="font-mono text-body-sm text-fg-muted">font-mono</dt>
        <dd className="font-mono text-body text-fg">0 9 * * 1 · routines/weekly-report.md</dd>
      </div>
    </dl>
  );
}

const meta = {
  title: 'Foundations/Typography',
  component: TypeScale,
  tags: ['!autodocs'],
} satisfies Meta<typeof TypeScale>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Scale: Story = {};
