"use client";

import {
  type ConnectionLineComponentProps,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  useInternalNode,
} from "@xyflow/react";
import {
  type MotionValue,
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { PlusIcon } from "lucide-react";
import { useEffect } from "react";

import {
  type GraphTone,
  graphToneStyle,
} from "@/components/pipecat/graph/tone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Span = { top: number; bottom: number };

/**
 * A wire is two cubic segments through a midpoint. Forward and backward wires
 * share this shape, so one can morph into the other when a node is dragged
 * past its neighbour.
 */
type Shape = { c1: Point; c2: Point; mid: Point; c3: Point; c4: Point };

/** How far a wire runs straight out of a port before it turns. */
const MIN_REACH = 36;
const LOOP_REACH = { min: 64, max: 120 };
/** The hook into the target is tighter, so it clears what sits to the target's left. */
const LOOP_ARRIVAL = 46;
/** A target at least this far right of the source gets a plain S-curve. */
const FORWARD_SLACK = 24;
/** Wires going down and wires going up use different lanes, so loops don't overlap. */
const LANE = 14;
const ROW_GAP = 40;
const UNDERPASS = 64;

function between(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * The y a backward wire travels along: the gap between the two nodes' rows, or
 * underneath both when they sit side by side.
 */
function gutterBetween(source: Span, target: Span) {
  if (target.top >= source.bottom + ROW_GAP)
    return (source.bottom + target.top) / 2 - LANE;
  if (source.top >= target.bottom + ROW_GAP)
    return (target.bottom + source.top) / 2 + LANE;
  return Math.max(source.bottom, target.bottom) + UNDERPASS;
}

/**
 * The control points of a wire from `source` to `target`. It leaves heading
 * right and arrives from the left, whichever way the ports face.
 */
export function wireShape(
  source: Point,
  target: Point,
  gutterY: number | null = null,
): Shape {
  if (target.x - source.x >= FORWARD_SLACK) {
    // One S-curve, split at its middle so it has the same shape as a loop.
    const reach = Math.max(MIN_REACH, (target.x - source.x) / 2);
    const out = { x: source.x + reach, y: source.y };
    const into = { x: target.x - reach, y: target.y };
    const c1 = between(source, out);
    const c4 = between(into, target);
    const top = between(out, into);
    const c2 = between(c1, top);
    const c3 = between(top, c4);
    return { c1, c2, mid: between(c2, c3), c3, c4 };
  }
  // The target is behind the source: hook out to the right, travel back along
  // the gutter, and hook into the target from its left.
  const reach = Math.min(
    LOOP_REACH.max,
    Math.max(LOOP_REACH.min, (source.x - target.x) / 4),
  );
  const y = gutterY ?? (source.y + target.y) / 2;
  return {
    c1: { x: source.x + reach, y: source.y },
    c2: { x: source.x + reach, y },
    mid: { x: (source.x + target.x) / 2, y },
    c3: { x: target.x - LOOP_ARRIVAL, y },
    c4: { x: target.x - LOOP_ARRIVAL, y: target.y },
  };
}

/** A wire's control points trail their ports on this, so it whips and settles. */
const SPRING = { stiffness: 170, damping: 9, mass: 0.9 };
/** How long a wire stays elastic after it is connected or re-routed. */
const BOUNCE_MS = 1200;

/**
 * Which bounce each value last played, and until when. Bookkeeping for
 * animations that live outside React, keyed by their motion value.
 */
const bounces = new WeakMap<
  MotionValue<number>,
  { key: string; until: number }
>();

/**
 * A motion value that follows `target`. It springs only while it is bouncing:
 * always when `bounce` is true, and for a moment each time `bounce` changes to
 * a new key. Otherwise it jumps, so the wire stays rigid as nodes move.
 */
function useSpringFollow(
  target: number,
  from: number,
  bounce: string | true | undefined,
) {
  const reduced = useReducedMotion();
  const value = useSpring(from, SPRING);
  // Motion's springs live outside React: a port position React Flow has just
  // worked out has to be pushed into them.
  useEffect(() => {
    let springing = bounce === true;
    if (typeof bounce === "string") {
      const now = performance.now();
      const last = bounces.get(value);
      if (last?.key !== bounce)
        bounces.set(value, { key: bounce, until: now + BOUNCE_MS });
      springing = last?.key !== bounce || now < last.until;
    }
    if (springing && !reduced) value.set(target);
    else value.jump(target);
  }, [value, target, reduced, bounce]);
  return value;
}

type WireOptions = {
  gutterY?: number | null;
  /** Extra droop in the middle, for a wire that isn't connected yet. */
  sag?: number;
  bounce?: string | true;
};

/**
 * The path of a wire whose ends are pinned to their ports. While it bounces,
 * its middle trails on springs; a wire that bounces from the start unfurls
 * from its source.
 */
function useWire(source: Point, target: Point, options: WireOptions = {}) {
  const { gutterY = null, sag = 0, bounce } = options;
  const shape = wireShape(source, target, gutterY);
  const unfurl = bounce !== undefined;
  const x = (to: number) => (unfurl ? source.x : to);
  const y = (to: number) => (unfurl ? source.y : to);

  const c1x = useSpringFollow(shape.c1.x, x(shape.c1.x), bounce);
  const c1y = useSpringFollow(shape.c1.y, y(shape.c1.y), bounce);
  const c2x = useSpringFollow(shape.c2.x, x(shape.c2.x), bounce);
  const c2y = useSpringFollow(shape.c2.y + sag, y(shape.c2.y + sag), bounce);
  const midX = useSpringFollow(shape.mid.x, x(shape.mid.x), bounce);
  const midY = useSpringFollow(shape.mid.y + sag, y(shape.mid.y + sag), bounce);
  const c3x = useSpringFollow(shape.c3.x, x(shape.c3.x), bounce);
  const c3y = useSpringFollow(shape.c3.y + sag, y(shape.c3.y + sag), bounce);
  const c4x = useSpringFollow(shape.c4.x, x(shape.c4.x), bounce);
  const c4y = useSpringFollow(shape.c4.y, y(shape.c4.y), bounce);

  const path = useTransform(
    () =>
      `M${source.x} ${source.y} C${c1x.get()} ${c1y.get()} ${c2x.get()} ${c2y.get()} ${midX.get()} ${midY.get()} C${c3x.get()} ${c3y.get()} ${c4x.get()} ${c4y.get()} ${target.x} ${target.y}`,
  );
  return { path, midX, midY };
}

function useGutter(sourceId: string, targetId: string) {
  const source = useInternalNode(sourceId);
  const target = useInternalNode(targetId);
  if (!source || !target) return null;
  const span = (node: NonNullable<typeof source>) => {
    const top = node.internals.positionAbsolute.y;
    return { top, bottom: top + (node.measured.height ?? 0) };
  };
  return gutterBetween(span(source), span(target));
}

export type NodeWireData = {
  /** The wire's tone. Left out, it takes the graph's. */
  tone?: GraphTone;
  /** A dashed wire with no signal dot, for a path that loops back. */
  dashed?: boolean;
  /** The dot drifting along the wire, showing which way it flows. On unless `false`. */
  signal?: boolean;
  /** The wire in use: heavier, with a halo in its tone. */
  active?: boolean;
  /** Give this a new value to make the wire spring, as when it is re-routed. */
  bounce?: string;
};

export type NodeWireEdge = Edge<NodeWireData, "wire">;

/**
 * A wire between two ports, as a React Flow edge type. It carries a drifting
 * signal dot, and unfurls on springs when it is connected. Its `label` sits on
 * its middle.
 */
export function NodeWire({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  label,
}: EdgeProps<NodeWireEdge>) {
  const gutterY = useGutter(source, target);
  const { path, midX, midY } = useWire(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    { gutterY, bounce: data?.bounce },
  );
  const active = data?.active === true;
  const dashed = data?.dashed === true;
  const signal = data?.signal !== false && !dashed;

  return (
    <g
      data-slot="node-wire"
      data-tone={data?.tone}
      data-active={active || undefined}
      style={graphToneStyle(data?.tone)}
    >
      {active ? (
        <motion.path
          d={path}
          className="stroke-graph-tone/30 fill-none"
          strokeWidth={8}
          strokeLinecap="round"
        />
      ) : null}
      <motion.path
        d={path}
        className={cn(
          "stroke-graph-tone fill-none",
          selected && "stroke-foreground",
        )}
        strokeWidth={selected || active ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray={dashed ? "7 7" : undefined}
      />
      {signal ? (
        // One dot per 56px of wire, drifting along it.
        <motion.path
          d={path}
          className="animate-wire-pulse stroke-graph-tone fill-none motion-reduce:animate-none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray="0.1 56"
        />
      ) : null}
      {/* A wide invisible stroke, so the wire is easy to click. */}
      <motion.path
        d={path}
        className="react-flow__edge-interaction fill-none stroke-transparent"
        strokeWidth={24}
      />
      {label ? (
        <EdgeLabelRenderer>
          {/* Labels are drawn outside the wire, so its tone is put in scope again. */}
          <motion.div
            data-slot="node-wire-label"
            data-tone={data?.tone}
            data-selected={selected || undefined}
            className="group/node-wire-label nodrag nopan pointer-events-auto absolute top-0 left-0 -translate-1/2"
            style={{ ...graphToneStyle(data?.tone), x: midX, y: midY }}
          >
            {label}
          </motion.div>
        </EdgeLabelRenderer>
      ) : null}
    </g>
  );
}

/** An icon-only button needs a name: one of these has to be given. */
type Named =
  | { "aria-label": string }
  | { "aria-labelledby": string }
  | { children: React.ReactNode };

export type NodeWireActionProps = React.ComponentProps<typeof Button> & Named;

/**
 * A small button for the middle of a wire, in the wire's tone: pass it as the
 * edge's `label`. It swells under the pointer, and inverts while it has
 * something open or its wire is selected.
 */
export function NodeWireAction({
  className,
  children,
  ...props
}: NodeWireActionProps) {
  return (
    <Button
      variant="outline"
      size="icon-xs"
      {...props}
      data-slot="node-wire-action"
      className={cn(
        "border-graph-tone bg-card text-graph-tone-ink size-4 rounded-full border-2 [&_svg]:stroke-[3.5] [&_svg:not([class*='size-'])]:size-2.5",
        // An overshooting ease stands in for a spring.
        "transition-[scale,background-color,color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-150 active:scale-125 motion-reduce:transition-none",
        "hover:bg-card hover:text-graph-tone-ink dark:border-graph-tone dark:bg-card dark:hover:bg-card",
        "aria-expanded:bg-foreground aria-expanded:text-background dark:aria-expanded:bg-foreground aria-expanded:scale-150",
        "group-data-selected/node-wire-label:bg-foreground group-data-selected/node-wire-label:text-background dark:group-data-selected/node-wire-label:bg-foreground group-data-selected/node-wire-label:scale-150",
        className,
      )}
    >
      {children ?? <PlusIcon aria-hidden />}
    </Button>
  );
}

/** How far a loose wire droops before it finds a port. */
const SLACK = 30;

/**
 * The wire being drawn, as React Flow's connection line. It hangs like a loose
 * rope while it follows the pointer, pulls taut when it snaps to a port that
 * fits, and turns red and dashed over one that doesn't.
 */
export function NodeWireConnection({
  fromX,
  fromY,
  toX,
  toY,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const snapped = connectionStatus === "valid";
  const refused = connectionStatus === "invalid";
  const { path } = useWire(
    { x: fromX, y: fromY },
    { x: toX, y: toY },
    { sag: snapped ? 0 : SLACK, bounce: true },
  );

  return (
    <g
      data-slot="node-wire-connection"
      style={graphToneStyle(refused ? "red" : undefined)}
    >
      <motion.path
        d={path}
        className="stroke-graph-tone fill-none"
        strokeWidth={snapped ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray={refused ? "6 7" : undefined}
      />
      {snapped ? null : (
        <circle cx={toX} cy={toY} r={5} className="fill-graph-tone" />
      )}
    </g>
  );
}
