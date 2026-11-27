import type { Meta, StoryObj } from '@storybook/react-vite';

interface Swatch {
  name: string;
  className: string;
}

interface SwatchGroup {
  title: string;
  swatches: Swatch[];
}

const GROUPS: SwatchGroup[] = [
  {
    title: 'Surfaces',
    swatches: [
      { name: 'page', className: 'bg-page' },
      { name: 'surface', className: 'bg-surface' },
      { name: 'raised', className: 'bg-raised' },
      { name: 'overlay', className: 'bg-overlay' },
      { name: 'hover', className: 'bg-hover' },
      { name: 'pressed', className: 'bg-pressed' },
    ],
  },
  {
    title: 'Lines',
    swatches: [
      { name: 'line-faint', className: 'bg-line-faint' },
      { name: 'line', className: 'bg-line' },
      { name: 'line-strong', className: 'bg-line-strong' },
    ],
  },
  {
    title: 'Text',
    swatches: [
      { name: 'fg', className: 'bg-fg' },
      { name: 'fg-prose', className: 'bg-fg-prose' },
      { name: 'fg-secondary', className: 'bg-fg-secondary' },
      { name: 'fg-muted', className: 'bg-fg-muted' },
      { name: 'fg-faint', className: 'bg-fg-faint' },
    ],
  },
  {
    title: 'Status',
    swatches: [
      { name: 'positive', className: 'bg-positive' },
      { name: 'negative', className: 'bg-negative' },
      { name: 'warning', className: 'bg-warning' },
      { name: 'info', className: 'bg-info' },
      { name: 'positive-soft', className: 'bg-positive-soft' },
      { name: 'negative-soft', className: 'bg-negative-soft' },
      { name: 'warning-soft', className: 'bg-warning-soft' },
      { name: 'info-soft', className: 'bg-info-soft' },
      { name: 'neutral-soft', className: 'bg-neutral-soft' },
    ],
  },
  {
    title: 'Brand',
    swatches: [
      { name: 'brand-violet', className: 'bg-brand-violet' },
      { name: 'brand-pink', className: 'bg-brand-pink' },
      { name: 'brand-peach', className: 'bg-brand-peach' },
    ],
  },
];

function Palette() {
  return (
    <div className="space-y-8">
      {GROUPS.map(group => (
        <section key={group.title}>
          <h2 className="mb-3 text-title-sm text-fg">{group.title}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-4">
            {group.swatches.map(swatch => (
              <li key={swatch.name} className="space-y-1.5">
                <div className={`h-14 rounded-lg border border-line-strong ${swatch.className}`} />
                <code className="font-mono text-body-sm text-fg-secondary">{swatch.name}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const meta = {
  title: 'Foundations/Colors',
  component: Palette,
  tags: ['!autodocs'],
} satisfies Meta<typeof Palette>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tokens: Story = {};
