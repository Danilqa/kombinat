import { Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listScenes, VIEWPORT, type SceneSegment } from '../timeline';
import { Stage } from './stage';

interface PreviewStageProps {
  segment: SceneSegment;
}

// Plays a scene in a loop, with a scrubber to stop on any moment of it.
export function PreviewStage({ segment }: PreviewStageProps) {
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function fit() {
      setScale(Math.min(1, (window.innerWidth - 48) / VIEWPORT.width));
    }
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let last = performance.now();
    function tick(now: number) {
      setTime(previous => (previous + (now - last) / 1000) % segment.seconds);
      last = now;
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [isPlaying, segment.seconds]);

  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-black p-6 font-sans text-fg">
      <nav className="flex flex-wrap gap-2 text-body-sm">
        {listScenes().map(({ scene }) => (
          <a
            key={scene}
            href={`?scene=${scene}`}
            className={
              scene === segment.scene
                ? 'rounded-full bg-fg px-3 py-1 text-page'
                : 'rounded-full bg-raised px-3 py-1 text-fg-secondary hover:text-fg'
            }
          >
            {scene}
          </a>
        ))}
      </nav>
      <div style={{ width: VIEWPORT.width * scale, height: VIEWPORT.height * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <Stage scene={segment.scene} time={time} />
        </div>
      </div>
      <div className="flex w-full max-w-320 items-center gap-3">
        <button
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={() => {
            setIsPlaying(!isPlaying);
          }}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-raised"
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input
          type="range"
          aria-label="Time"
          min={0}
          max={segment.seconds}
          step={0.01}
          value={time}
          onChange={event => {
            setIsPlaying(false);
            setTime(Number(event.target.value));
          }}
          className="flex-1"
        />
        <span className="w-24 text-right font-mono text-body-sm text-fg-secondary tabular-nums">
          {time.toFixed(2)} / {segment.seconds.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
