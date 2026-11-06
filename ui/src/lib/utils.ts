import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['title-lg', 'title-md', 'title-sm', 'body', 'body-sm', 'caption', 'nav', 'nav-sm'],
        },
      ],
      shadow: [{ shadow: ['popover', 'focus'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
