import type { Preview } from '@storybook/react-vite';
import { Tooltip } from 'design-system';
import { theme } from './theme';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    backgrounds: { disabled: true },
    docs: { theme },
    options: { storySort: { order: ['Foundations', 'Components'] } },
  },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <Tooltip.Provider delayDuration={300}>
        <Story />
      </Tooltip.Provider>
    ),
  ],
};

export default preview;
