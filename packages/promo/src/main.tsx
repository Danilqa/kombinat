import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { findScene, listScenes } from './timeline';
import { PreviewStage } from './stage/preview-stage';
import { RecordStage } from './stage/record-stage';
import { Frame } from './stage/stage';
import { ThumbnailStill } from './stills/thumbnail-still';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

const params = new URLSearchParams(window.location.search);
const segment = findScene(params.get('scene') ?? '') ?? listScenes()[0];
if (!segment) throw new Error('The timeline has no scenes');

createRoot(rootElement).render(
  <StrictMode>
    {params.get('still') === 'thumbnail' ? (
      <Frame>
        <ThumbnailStill />
      </Frame>
    ) : params.has('record') ? (
      <RecordStage scene={segment.scene} />
    ) : (
      <PreviewStage segment={segment} />
    )}
  </StrictMode>,
);
