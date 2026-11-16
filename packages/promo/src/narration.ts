import type { SegmentName } from './timeline';

export interface NarrationLine {
  segment: SegmentName;
  // A tour caption to start on. Without it, the line starts with its segment.
  cue?: string;
  text: string;
  // What the voice reads when it differs from the text, such as a command.
  spoken?: string;
  // Fish Audio makes two takes of each line. Without this, the one closest to the target pace wins.
  take?: 'a' | 'b';
}

// The voice in Fish Audio's text to speech, with the model Fish Audio Drama 3 at speed 1x.
export const VOICE = 'Sarah';
// Kombinat said as in Russian, комбинат, with the stress on the last syllable.
const SPOKEN_NAME = 'Kombinaht';

// The voiceover. Each line is one clip.
export const NARRATION: NarrationLine[] = [
  {
    segment: 'title',
    text: 'Kombinat runs your AI agents twenty-four seven, while you focus on what matters.',
  },
  {
    segment: 'routine-file',
    text: 'Each routine is a Markdown file: the schedule and settings on top, the prompt below.',
  },
  {
    segment: 'team-flow',
    text: 'Anyone on the team can add one with a pull request. Once it’s merged, it runs on its schedule.',
  },
  {
    segment: 'work',
    text: 'Teams use it for on-call, release monitoring, bug fixes, design and accessibility reviews, go-to-market research, and more.',
  },
  {
    segment: 'delegate',
    text: 'For example, hand off a task: just mention Kombinat in a chat or on an issue.',
  },
  {
    segment: 'webhook',
    text: 'A webhook starts the routine, the request goes into the prompt, and the agent reports back when it’s done.',
  },
  {
    segment: 'home',
    text: 'And at home, anything you can imagine: catching discounts, booking appointments, checking the weather, or watching a website.',
  },
  {
    segment: 'tour',
    text: 'The dashboard shows every routine, and your whole week at a glance.',
  },
  {
    segment: 'tour',
    cue: 'Search routines and runs with ⌘K',
    text: 'Find any routine in a second, and open any run to read what the agent did.',
  },
  {
    segment: 'outro',
    text: 'Kombinat is free and open source. Get started with npx kombinat init.',
    spoken: 'Kombinat is free and open source. Get started with N P X, Kombinat init.',
  },
];

export function toSpokenText(line: NarrationLine): string {
  return (line.spoken ?? line.text).replaceAll('Kombinat', SPOKEN_NAME);
}
