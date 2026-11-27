import type { ReactNode } from 'react';
import { cn } from 'design-system';
import bolt from './drawings/mark-bolt.svg';
import burst from './drawings/mark-burst.svg';
import sparks from './drawings/mark-sparks.svg';
import sledge from './drawings/tool-sledge.svg';
import wrench from './drawings/tool-wrench.svg';
import cyclops from './drawings/worker-cyclops.svg';
import gears from './drawings/worker-gears.svg';
import hardhat from './drawings/worker-hardhat.svg';
import lookout from './drawings/worker-lookout.svg';
import muffs from './drawings/worker-muffs.svg';
import newspaper from './drawings/worker-newspaper.svg';
import undercover from './drawings/worker-undercover.svg';
import { Hand, Mark, Tool, Worker } from './workers';

// What shows of a worker behind the bottom left corner of a panel: all that is left of the panel
// and all that is under it. The corner sits at 160, 260 of the box and is rounded by 12.
const AROUND_BOTTOM_LEFT_CORNER = "path('M0 0H160V248A12 12 0 0 0 172 260H280V300H0Z')";

interface PanelSceneProps {
  className?: string;
  behind: ReactNode;
  inFront?: ReactNode;
  children: ReactNode;
}

// The workers stand around the panel from the two-column layout up, where it has room beside it.
function PanelScene({ className, behind, inFront, children }: PanelSceneProps) {
  return (
    <div className={className}>
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none max-lg:hidden">
          {behind}
        </div>
        {children}
        {inFront && (
          <div aria-hidden="true" className="pointer-events-none max-lg:hidden">
            {inFront}
          </div>
        )}
      </div>
    </div>
  );
}

interface AboveTopEdgeProps {
  children: ReactNode;
}

// Ends at the top edge of the panel and cuts the workers there, so they stand behind it.
function AboveTopEdge({ children }: AboveTopEdgeProps) {
  return <div className="absolute inset-x-0 bottom-full h-20 overflow-hidden">{children}</div>;
}

interface FromBottomLeftCornerProps {
  children: ReactNode;
}

// Its top left corner is the bottom left corner of the panel, whatever the height of the panel.
function FromBottomLeftCorner({ children }: FromBottomLeftCornerProps) {
  return <div className="absolute bottom-0 left-0 max-xl:hidden">{children}</div>;
}

interface HidingWorkersProps {
  children: ReactNode;
}

export function HidingWorkers({ children }: HidingWorkersProps) {
  return (
    <PanelScene
      className="lg:pt-10"
      behind={
        <>
          <AboveTopEdge>
            <Worker
              drawing={gears}
              width={135}
              facing="right"
              peeksFrom="below"
              delay={500}
              className="bottom-1 left-28"
            />
            <Worker
              drawing={cyclops}
              width={135}
              facing="left"
              peeksFrom="below"
              delay={700}
              className="bottom-4 left-76.5"
            />
          </AboveTopEdge>
          <div
            className="absolute -bottom-10 -left-40 h-75 w-70 max-xl:hidden"
            style={{ clipPath: AROUND_BOTTOM_LEFT_CORNER }}
          >
            <Worker
              drawing={hardhat}
              width={150}
              facing="left"
              peeksFrom="right"
              delay={950}
              tilt={-13}
              className="top-50.25 left-33.5"
            />
          </div>
        </>
      }
      inFront={
        <>
          <Hand delay={550} className="-top-0.75 left-65.5" />
          <FromBottomLeftCorner>
            <Hand delay={800} className="-top-22.25 -left-px -rotate-90" />
          </FromBottomLeftCorner>
        </>
      }
    >
      {children}
    </PanelScene>
  );
}

interface AlertedWorkerProps {
  children: ReactNode;
}

export function AlertedWorker({ children }: AlertedWorkerProps) {
  return (
    <PanelScene
      className="lg:pt-10"
      behind={
        <AboveTopEdge>
          <Worker
            drawing={cyclops}
            width={135}
            facing="left"
            peeksFrom="below"
            delay={950}
            className="bottom-3.75 left-21"
          />
        </AboveTopEdge>
      }
      inFront={
        <>
          <Hand delay={850} className="-top-0.75 left-33" />
          <div className="max-xl:hidden">
            <Mark drawing={bolt} delay={350} className="top-6.5 -left-11.5 w-16 -rotate-14" />
            <Mark drawing={burst} delay={500} className="top-23 -left-21 w-13.5 rotate-8" />
            <Mark drawing={sparks} delay={650} className="top-39.5 -left-10.5 w-14.5 -rotate-70" />
          </div>
        </>
      }
    >
      {children}
    </PanelScene>
  );
}

interface WorkersWithToolsProps {
  children: ReactNode;
}

export function WorkersWithTools({ children }: WorkersWithToolsProps) {
  return (
    <PanelScene
      className="lg:py-10"
      behind={
        <AboveTopEdge>
          <Worker
            drawing={hardhat}
            width={132}
            facing="right"
            peeksFrom="below"
            delay={500}
            className="bottom-3.5 left-17.5"
          />
          <Worker
            drawing={muffs}
            width={132}
            facing="left"
            peeksFrom="below"
            delay={650}
            className="bottom-4 left-50"
          />
          <Worker
            drawing={cyclops}
            width={132}
            facing="left"
            peeksFrom="below"
            delay={800}
            className="bottom-3.5 left-82.5"
          />
          <Tool drawing={wrench} width={50} delay={950} tilt={-7} className="bottom-2 left-34" />
          <Tool drawing={sledge} width={50} delay={1050} tilt={8} className="bottom-2 left-66.5" />
        </AboveTopEdge>
      }
    >
      {children}
    </PanelScene>
  );
}

interface UndercoverWorkersProps {
  children: ReactNode;
}

export function UndercoverWorkers({ children }: UndercoverWorkersProps) {
  return (
    <PanelScene
      className="lg:pt-10"
      behind={
        <AboveTopEdge>
          <Worker
            drawing={undercover}
            width={126}
            facing="right"
            peeksFrom="below"
            delay={500}
            className="bottom-3 left-24.5"
          />
          <Worker
            drawing={newspaper}
            width={126}
            facing="left"
            peeksFrom="below"
            delay={650}
            className="bottom-5.5 left-66.75"
          />
          <Worker
            drawing={lookout}
            width={126}
            facing="left"
            peeksFrom="below"
            delay={800}
            className="bottom-3 left-88.75"
          />
        </AboveTopEdge>
      }
    >
      {children}
    </PanelScene>
  );
}

interface PhoneSceneProps {
  className: string;
  children: ReactNode;
}

// On a phone a card shows no panel, so its workers look in from the edges of the card instead.
// The scene keeps its height free under the text and reaches the edges through the card's padding.
function PhoneScene({ className, children }: PhoneSceneProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none relative -mx-5 mt-auto -mb-5 self-stretch sm:hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function HidingWorkersOnPhone() {
  return (
    <PhoneScene className="h-39">
      <Worker
        drawing={cyclops}
        width={135}
        facing="right"
        peeksFrom="left"
        delay={700}
        tilt={14}
        className="top-14.5 left-2.5"
      />
      <Worker
        drawing={hardhat}
        width={150}
        facing="left"
        peeksFrom="right"
        delay={900}
        tilt={-16}
        className="top-18 right-3"
      />
      <Worker
        drawing={muffs}
        width={180}
        facing="left"
        peeksFrom="below"
        delay={500}
        className="top-32.5 left-1/2"
      />
    </PhoneScene>
  );
}

export function AlertedWorkerOnPhone() {
  return (
    <PhoneScene className="h-23">
      <Mark drawing={bolt} delay={350} className="top-9 left-[16%] w-14 -rotate-14" />
      <Mark drawing={burst} delay={500} className="top-14 left-[36%] w-11 rotate-8" />
      <Mark drawing={sparks} delay={650} className="top-9 left-[88%] w-12 rotate-30" />
      <Worker
        drawing={cyclops}
        width={150}
        facing="left"
        peeksFrom="below"
        delay={850}
        className="top-18 left-[62%]"
      />
    </PhoneScene>
  );
}

export function WorkersWithToolsOnPhone() {
  return (
    <PhoneScene className="h-30">
      <Worker
        drawing={hardhat}
        width={120}
        facing="right"
        peeksFrom="below"
        delay={500}
        className="top-24.5 left-[17%]"
      />
      <Worker
        drawing={muffs}
        width={120}
        facing="left"
        peeksFrom="below"
        delay={650}
        className="top-24 left-1/2"
      />
      <Worker
        drawing={cyclops}
        width={120}
        facing="left"
        peeksFrom="below"
        delay={800}
        className="top-24.5 left-[83%]"
      />
      <Tool drawing={wrench} width={46} delay={950} tilt={-7} className="top-28.5 left-[33.5%]" />
      <Tool drawing={sledge} width={46} delay={1050} tilt={8} className="top-28.5 left-[66.5%]" />
    </PhoneScene>
  );
}

export function UndercoverWorkersOnPhone() {
  return (
    <PhoneScene className="h-30">
      <Worker
        drawing={undercover}
        width={120}
        facing="right"
        peeksFrom="below"
        delay={500}
        className="top-24.5 left-[18%]"
      />
      <Worker
        drawing={newspaper}
        width={120}
        facing="left"
        peeksFrom="below"
        delay={650}
        className="top-22.5 left-1/2"
      />
      <Worker
        drawing={lookout}
        width={120}
        facing="left"
        peeksFrom="below"
        delay={800}
        className="top-24.5 left-[82%]"
      />
    </PhoneScene>
  );
}
