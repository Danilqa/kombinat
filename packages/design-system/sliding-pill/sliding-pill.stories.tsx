import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../button';
import { SlidingPill } from './sliding-pill';
import { useState } from 'react';

const ITEMS = ['Routines', 'Runs', 'Calendar', 'Insights'];

function NavDemo() {
  const [active, setActive] = useState(ITEMS[0]);
  return (
    <nav aria-label="Main" className="relative w-fit">
      <SlidingPill activeSelector="[data-active]" />
      <ul className="flex items-center gap-1">
        {ITEMS.map(item => (
          <li key={item}>
            <Button
              variant="tertiary"
              size="small"
              isActive={item === active}
              aria-current={item === active ? 'page' : undefined}
              className="relative bg-transparent interactive:hover:bg-transparent interactive:active:bg-transparent"
              onClick={() => setActive(item)}
            >
              {item}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const meta = {
  title: 'Components/SlidingPill',
  component: SlidingPill,
  args: { activeSelector: '[data-active]' },
} satisfies Meta<typeof SlidingPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Navigation: Story = {
  render: () => <NavDemo />,
};
