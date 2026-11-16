import type { ReactNode } from 'react';
import { VIEWPORT, type SceneName } from '../timeline';
import { SCENES } from '../scenes';

interface StageProps {
  scene: SceneName;
  time: number;
}

interface FrameProps {
  children: ReactNode;
}

// The 1280×720 canvas with the background glow that every scene and still sits on.
export function Frame({ children }: FrameProps) {
  return (
    <div
      className="relative overflow-hidden bg-page font-sans text-fg"
      style={{ width: VIEWPORT.width, height: VIEWPORT.height }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_50%_36%,rgba(150,120,255,0.075),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_50%,transparent_55%,rgba(0,0,0,0.55))]" />
      {children}
    </div>
  );
}

export function Stage({ scene, time }: StageProps) {
  const Scene = SCENES[scene];
  return (
    <Frame>
      <Scene time={time} />
    </Frame>
  );
}
