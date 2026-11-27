import { createLucideIcon } from 'lucide-react';

const HAND_TILT = 'rotate(-20 14 14) translate(1 1) scale(.86)';

export const WavingHand = createLucideIcon('waving-hand', [
  ['path', { d: 'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2', transform: HAND_TILT, key: 'finger-1' }],
  ['path', { d: 'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2', transform: HAND_TILT, key: 'finger-2' }],
  [
    'path',
    { d: 'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8', transform: HAND_TILT, key: 'finger-3' },
  ],
  [
    'path',
    {
      d: 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
      transform: HAND_TILT,
      key: 'palm',
    },
  ],
  ['path', { d: 'M1.5 9a7.5 7.5 0 0 1 2.7-5.6', key: 'wave-top' }],
  ['path', { d: 'M22 16.5a7 7 0 0 1-3.5 5.5', key: 'wave-bottom' }],
]);

export const SandBucket = createLucideIcon('sand-bucket', [
  ['path', { d: 'M3 11h11l-1.4 9.2a2 2 0 0 1-2 1.8H6.4a2 2 0 0 1-2-1.8Z', key: 'bucket' }],
  ['path', { d: 'M4.5 11a4 4 0 0 1 8 0', key: 'bucket-handle' }],
  ['path', { d: 'M19 2v10', key: 'shovel-shaft' }],
  ['path', { d: 'M17 2h4', key: 'shovel-grip' }],
  ['path', { d: 'M16.5 12h5v3.5a2.5 2.5 0 0 1-5 0Z', key: 'shovel-blade' }],
]);
