import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { findScene, listScenes } from './timeline';
import { PreviewStage } from './stage/preview-stage';
import { RecordStage } from './stage/record-stage';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

const params = new URLSearchParams(window.location.search);
const segment = findScene(params.get('scene') ?? '') ?? listScenes()[0];
if (!segment) throw new Error('The timeline has no scenes');

createRoot(rootElement).render(
  <StrictMode>
    {params.has('record') ? (
      <RecordStage scene={segment.scene} />
    ) : (
      <PreviewStage segment={segment} />
    )}
  </StrictMode>,
);
