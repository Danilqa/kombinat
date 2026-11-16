import { match } from 'ts-pattern';

export type SceneName =
  'title' | 'routine-file' | 'team-flow' | 'delegate' | 'webhook' | 'home' | 'outro';

export interface SceneSegment {
  kind: 'scene';
  scene: SceneName;
  seconds: number;
}

export interface TourSegment {
  kind: 'tour';
}

export type Segment = SceneSegment | TourSegment;

export interface Size {
  width: number;
  height: number;
}

// Pages are laid out at 1280×720 and captured at 1.5×, so the video is 1920×1080.
export const VIEWPORT: Size = { width: 1280, height: 720 };
export const DEVICE_SCALE = 1.5;
export const FPS = 30;
export const CROSSFADE_SECONDS = 0.4;

export const TIMELINE: Segment[] = [
  { kind: 'scene', scene: 'title', seconds: 3 },
  { kind: 'scene', scene: 'routine-file', seconds: 6 },
  { kind: 'scene', scene: 'team-flow', seconds: 7 },
  { kind: 'scene', scene: 'delegate', seconds: 6 },
  { kind: 'scene', scene: 'webhook', seconds: 8.5 },
  { kind: 'tour' },
  { kind: 'scene', scene: 'home', seconds: 7 },
  { kind: 'scene', scene: 'outro', seconds: 4 },
];

export function listScenes(): SceneSegment[] {
  return TIMELINE.flatMap(segment =>
    match(segment)
      .with({ kind: 'scene' }, scene => [scene])
      .with({ kind: 'tour' }, () => [])
      .exhaustive(),
  );
}

export function toSegmentName(segment: Segment): string {
  return match(segment)
    .with({ kind: 'scene' }, ({ scene }) => scene)
    .with({ kind: 'tour' }, () => 'tour')
    .exhaustive();
}

export function findScene(name: string): SceneSegment | undefined {
  return listScenes().find(segment => segment.scene === name);
}
