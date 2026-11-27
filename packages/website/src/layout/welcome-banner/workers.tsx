import { cn } from 'design-system';
import hand from './drawings/hand.svg';

type Facing = 'left' | 'right';

type PeekSide = 'below' | 'left' | 'right';

interface DrawingShape {
  anchorTop: number;
  origin: string;
}

// A worker is drawn 300 by 445, faces right and has the centre of its head at 150, 155.
const WORKER_SHAPE: DrawingShape = { anchorTop: 155 / 300, origin: `50% ${(155 / 445) * 100}%` };

// A tool is drawn 120 by 170, with the hand that holds it at 60, 140.
const TOOL_SHAPE: DrawingShape = { anchorTop: 140 / 120, origin: `50% ${(140 / 170) * 100}%` };

const FACING_SCALES: Record<Facing, string> = { right: '1 1', left: '-1 1' };

const PEEK_CLASSES: Record<PeekSide, string> = {
  below: 'group-data-active/slide:motion-safe:animate-worker-peek-up',
  left: 'group-data-active/slide:motion-safe:animate-worker-peek-left',
  right: 'group-data-active/slide:motion-safe:animate-worker-peek-right',
};

const POP_CLASS = 'group-data-active/slide:motion-safe:animate-worker-pop';

// A slide comes into view before it is the active one, so its drawings wait out of sight until then.
const SHOWN_WHILE_ACTIVE_CLASS =
  'motion-safe:opacity-0 motion-safe:transition-opacity motion-safe:duration-150 group-data-active/slide:motion-safe:opacity-100';

interface PeekingDrawingProps {
  drawing: string;
  shape: DrawingShape;
  width: number;
  facing: Facing;
  peeksFrom: PeekSide;
  delay: number;
  tilt: number;
  className: string;
}

// The classes place the anchor of the drawing, so it keeps its place at any size.
function PeekingDrawing({
  drawing,
  shape,
  width,
  facing,
  peeksFrom,
  delay,
  tilt,
  className,
}: PeekingDrawingProps) {
  return (
    <span className={cn('absolute', className)}>
      <img
        src={drawing}
        alt=""
        className={cn('absolute max-w-none', SHOWN_WHILE_ACTIVE_CLASS, PEEK_CLASSES[peeksFrom])}
        style={{
          width,
          left: -width / 2,
          top: -width * shape.anchorTop,
          transformOrigin: shape.origin,
          rotate: `${tilt}deg`,
          scale: FACING_SCALES[facing],
          animationDelay: `${delay}ms`,
        }}
      />
    </span>
  );
}

interface WorkerProps {
  drawing: string;
  width: number;
  facing: Facing;
  peeksFrom: PeekSide;
  delay: number;
  tilt?: number;
  className: string;
}

export function Worker({ tilt = 0, ...props }: WorkerProps) {
  return <PeekingDrawing shape={WORKER_SHAPE} tilt={tilt} {...props} />;
}

interface ToolProps {
  drawing: string;
  width: number;
  delay: number;
  tilt: number;
  className: string;
}

export function Tool(props: ToolProps) {
  return <PeekingDrawing shape={TOOL_SHAPE} facing="right" peeksFrom="below" {...props} />;
}

interface MarkProps {
  drawing: string;
  delay: number;
  className: string;
}

// The classes place the centre of the mark.
export function Mark({ drawing, delay, className }: MarkProps) {
  return (
    <img
      src={drawing}
      alt=""
      className={cn(
        'absolute max-w-none -translate-1/2',
        SHOWN_WHILE_ACTIVE_CLASS,
        POP_CLASS,
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

interface HandProps {
  delay: number;
  className: string;
}

export function Hand({ delay, className }: HandProps) {
  return <Mark drawing={hand} delay={delay} className={cn('w-6.5', className)} />;
}

interface WorkerHeadProps {
  drawing: string;
}

// A head is drawn 222 by 200 with its linework in the centre, so it lines up as an icon does.
export function WorkerHead({ drawing }: WorkerHeadProps) {
  return <img src={drawing} alt="" className="aspect-111/100 w-8 shrink-0 sm:w-10.5" />;
}
