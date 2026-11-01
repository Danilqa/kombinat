import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'headline-h1',
            'headline-h3',
            'title-16',
            'title-14',
            'paragraph-16',
            'paragraph-14',
            'paragraph-12',
            'label-16',
            'label-13',
          ],
        },
      ],
      rounded: [{ rounded: ['4', '8', '16'] }],
      shadow: [{ shadow: ['elevation-100', 'elevation-200', 'focus'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
