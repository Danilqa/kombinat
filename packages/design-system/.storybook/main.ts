import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../*/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  staticDirs: ['./public'],
  core: { disableTelemetry: true },
  viteFinal: viteConfig => mergeConfig(viteConfig, { plugins: [react(), tailwindcss()] }),
};

export default config;
