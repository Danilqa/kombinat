import type { ComponentType } from 'react';
import type { SceneName } from '../timeline';
import { DelegateScene } from './delegate-scene';
import { HomeScene } from './home-scene';
import { OutroScene } from './outro-scene';
import { RoutineFileScene } from './routine-file-scene';
import { TeamFlowScene } from './team-flow-scene';
import { TitleScene } from './title-scene';
import { WebhookScene } from './webhook-scene';

interface SceneProps {
  // Seconds since the scene started.
  time: number;
}

export const SCENES: Record<SceneName, ComponentType<SceneProps>> = {
  title: TitleScene,
  'routine-file': RoutineFileScene,
  'team-flow': TeamFlowScene,
  delegate: DelegateScene,
  webhook: WebhookScene,
  home: HomeScene,
  outro: OutroScene,
};
