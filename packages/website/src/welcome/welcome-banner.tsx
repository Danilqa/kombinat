import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  MoonStar,
  Play,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from 'design-system/components';
import { cn } from 'design-system/utils';
import { CALENDAR_PATH, ROUTINES_PATH, RUNS_PATH, getRoutinePath } from 'web-app/constants/path';
import { demoRoutines } from '../demo-api/routines';
import { CodePanel } from './code-panel';
import { WelcomeCard } from './welcome-card';
import { SandBucket, WavingHand } from './welcome-icons';

const REPO_URL = 'https://github.com/Danilqa/kombinat';
const NPM_URL = 'https://www.npmjs.com/package/@danilqa/kombinat';

interface Slide {
  label: string;
  content: ReactNode;
}

interface ExploreLink {
  to: string;
  icon: LucideIcon;
  title: string;
  caption: string;
}

const EXPLORE_LINKS: ExploreLink[] = [
  {
    to: getRoutinePath('night-agent-tasks'),
    icon: MoonStar,
    title: 'Night agents',
    caption: 'Draft PRs while you sleep',
  },
  {
    to: getRoutinePath('write-release-notes'),
    icon: Play,
    title: 'A transcript',
    caption: 'Every tool call of a run',
  },
  { to: CALENDAR_PATH, icon: CalendarDays, title: 'The week', caption: 'Past and planned runs' },
  { to: RUNS_PATH, icon: History, title: 'Every run', caption: 'Status, turns and cost' },
];

function checkPrefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getSlideElements(track: HTMLElement): HTMLElement[] {
  return [...track.children].filter(child => child instanceof HTMLElement);
}

interface ExternalLinkProps extends ComponentProps<'a'> {
  href: string;
}

// Button asChild passes its classes down, so the rest of the props go to the anchor.
function ExternalLink({ href, children, ...props }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" {...props}>
      {children}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

function RoutineFile() {
  return (
    <CodePanel title="routines/night-agent-tasks.md">
      <span className="text-fg-faint">---</span>
      {'\n'}
      <span className="text-fg-muted">name:</span> night-agent-tasks{'\n'}
      <span className="text-fg-muted">schedule:</span> '0 2 * * *'{'\n'}
      <span className="text-fg-muted">agent:</span> claude{'\n'}
      <span className="text-fg-muted">model:</span> claude-opus-5-5{'\n'}
      <span className="text-fg-faint">---</span>
      {'\n\n'}
      Pick up the open issues labelled `agent`,{'\n'}
      implement each one and open a draft PR.
    </CodePanel>
  );
}

function InstallCommands() {
  return (
    <CodePanel title="Terminal">
      <span className="text-fg-faint">$ </span>pnpm add @danilqa/kombinat{'\n'}
      <span className="text-fg-faint">$ </span>mkdir routines{'\n'}
      <span className="text-fg-faint">$ </span>vim routines/night-agent-tasks.md{'\n'}
      <span className="text-fg-faint">$ </span>pnpm kombinat serve{'\n'}
      <span className="text-positive">ui at http://localhost:7433</span>
    </CodePanel>
  );
}

function ExploreLinks() {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {EXPLORE_LINKS.map(({ to, icon: Icon, title, caption }) => (
        <li key={to}>
          <Link
            to={to}
            className="flex h-full flex-col gap-2 rounded-xl border border-line bg-page/60 p-3 transition-colors hover:border-line-strong hover:bg-raised"
          >
            <Icon aria-hidden="true" className="size-4 text-fg-muted" />
            <span className="flex flex-col">
              <span className="text-body font-medium text-fg">{title}</span>
              <span className="text-body-sm text-fg-muted">{caption}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function WelcomeBanner() {
  const { pathname } = useLocation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  function showSlide(index: number) {
    const track = trackRef.current;
    if (track === null) return;
    const slides = getSlideElements(track);
    const slide = slides[(index + slides.length) % slides.length];
    if (slide === undefined) return;
    track.scrollTo({
      left: slide.offsetLeft,
      behavior: checkPrefersReducedMotion() ? 'auto' : 'smooth',
    });
  }

  function updateActiveIndex() {
    const track = trackRef.current;
    if (track === null) return;
    const distances = getSlideElements(track).map(slide =>
      Math.abs(slide.offsetLeft - track.scrollLeft),
    );
    setActiveIndex(distances.indexOf(Math.min(...distances)));
  }

  const slides: Slide[] = [
    {
      label: 'Welcome',
      content: (
        <WelcomeCard
          label="Welcome"
          icon={WavingHand}
          glow="lavender"
          title="Background agents, on a schedule"
          aside={<RoutineFile />}
          actions={
            <>
              <Button asChild size="small">
                <ExternalLink href={REPO_URL}>View on GitHub</ExternalLink>
              </Button>
              <Button variant="secondary" size="small" onClick={() => showSlide(1)}>
                How to install
                <ArrowRight aria-hidden="true" />
              </Button>
            </>
          }
        >
          <p>
            <strong>Kombinat</strong> is a dead simple engine for 24/7 AI agents. A routine is a
            markdown file with a cron schedule, and <strong>Claude</strong>, <strong>Codex</strong>{' '}
            or any shell command runs it with the subscription you already have. This is a live demo
            of its dashboard.
          </p>
        </WelcomeCard>
      ),
    },
    {
      label: 'Install',
      content: (
        <WelcomeCard
          label="Install"
          icon={SquareTerminal}
          glow="peach"
          title="Running in a minute"
          aside={<InstallCommands />}
          actions={
            <>
              <Button asChild size="small">
                <ExternalLink href={`${REPO_URL}#readme`}>Read the quickstart</ExternalLink>
              </Button>
              <Button asChild variant="secondary" size="small">
                <ExternalLink href={NPM_URL}>npm package</ExternalLink>
              </Button>
            </>
          }
        >
          <p>
            Add the package to the repository that holds your routines, put a routine in{' '}
            <strong>routines/</strong> and start it. The dashboard opens at{' '}
            <strong>localhost:7433</strong>, and <strong>pnpm kombinat install</strong> keeps it
            running in the background and after reboots.
          </p>
        </WelcomeCard>
      ),
    },
    {
      label: 'Playground',
      content: (
        <WelcomeCard
          label="Playground"
          icon={SandBucket}
          glow="mint"
          title="Make yourself at home"
          aside={<ExploreLinks />}
        >
          <p>
            Click around, open any run and press <strong>Run now</strong>: it finishes in 30
            seconds. Everything here is made up. The {demoRoutines.length} routines of an imaginary
            team and their runs, transcripts and calendar are generated in your browser, so nothing
            leaves this page.
          </p>
        </WelcomeCard>
      ),
    },
  ];

  if (pathname !== ROUTINES_PATH) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="About this demo"
      className="mx-auto mb-6 max-w-[1180px]"
    >
      <div
        ref={trackRef}
        onScroll={updateActiveIndex}
        className="relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div
            key={slide.label}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}: ${slide.label}`}
            inert={index !== activeIndex}
            className="w-full shrink-0 snap-start px-4 sm:px-6"
          >
            {slide.content}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center">
          {slides.map((slide, index) => (
            <button
              key={slide.label}
              type="button"
              aria-label={`Show ${slide.label}`}
              aria-current={index === activeIndex || undefined}
              onClick={() => showSlide(index)}
              className="group flex h-6 cursor-pointer items-center px-1"
            >
              <span
                className={cn(
                  'block h-1.5 rounded-full transition-all',
                  index === activeIndex ? 'w-5 bg-fg' : 'w-1.5 bg-fg-faint group-hover:bg-fg-muted',
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="tertiary"
            size="icon-small"
            aria-label="Previous card"
            onClick={() => showSlide(activeIndex - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-9 text-center text-body-sm text-fg-muted tabular-nums">
            {activeIndex + 1} / {slides.length}
          </span>
          <Button
            variant="tertiary"
            size="icon-small"
            aria-label="Next card"
            onClick={() => showSlide(activeIndex + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
