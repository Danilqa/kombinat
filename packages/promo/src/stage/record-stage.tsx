import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import type { SceneName } from '../timeline';
import { Stage } from './stage';
import './promo-api';

interface RecordStageProps {
  scene: SceneName;
}

function syncAnimations(time: number) {
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = time * 1000;
  }
}

function waitForPaint() {
  return new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

// The recorder seeks to each frame, so CSS animations follow the scene's time, not the clock.
export function RecordStage({ scene }: RecordStageProps) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    window.promo = {
      seek: async nextTime => {
        flushSync(() => {
          setTime(nextTime);
        });
        syncAnimations(nextTime);
        await waitForPaint();
      },
    };
    return () => {
      delete window.promo;
    };
  }, []);

  return <Stage scene={scene} time={time} />;
}
