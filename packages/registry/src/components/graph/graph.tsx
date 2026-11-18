"use client";

import {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
  ReactFlow,
  type ReactFlowInstance,
  type ReactFlowProps,
  type ReactFlowState,
  type XYPosition,
  useNodesInitialized,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { animate } from "motion/react";
import { useEffect, useRef } from "react";

import {
  boxGroups,
  type GroupDirection,
  lineUpGroups,
  separateGroups,
} from "@/components/pipecat/graph/group-layout";
import {
  type GraphTone,
  graphToneStyle,
} from "@/components/pipecat/graph/tone";
import { cn } from "@/lib/utils";

const PATTERNS = {
  dots: BackgroundVariant.Dots,
  lines: BackgroundVariant.Lines,
  cross: BackgroundVariant.Cross,
} as const;

export type GraphPattern = keyof typeof PATTERNS | "none";

/** How a graph is framed: all of it in view, never zoomed in past actual size. */
export const GRAPH_FIT = { padding: 0.08, maxZoom: 1 } as const;

/** Groups pushed out of the way land on this spring. */
const GLIDE = {
  type: "spring",
  stiffness: 420,
  damping: 22,
  mass: 0.8,
} as const;

type Glide = ReturnType<typeof animate>;

/** How a group lays out its nodes: in a row, in a column, or wherever they are put. */
export type GraphGroupPacking = GroupDirection | "off";

export type ArrangeOptions = {
  /** The grid's pitch in px. */
  grid: number;
  /** Line each group's nodes up in a row or a column. Off unless set. */
  groups?: GraphGroupPacking;
  /** Keep groups apart. On unless `false`. */
  separate?: boolean;
  /** The least room between two groups, in cells. Three unless set. */
  gap?: number;
  /** The groups that stay put: the ones just dragged. */
  anchors?: readonly string[];
};

/**
 * Tidies the groups: lines their nodes up if asked, boxes each around its
 * nodes, and parts the ones that crowd each other. Sizes change at once and
 * whatever has to move glides there. Returns the glide, so it can be stopped.
 */
export function arrangeGroups<N extends Node, E extends Edge>(
  flow: ReactFlowInstance<N, E>,
  {
    grid,
    groups = "off",
    separate = true,
    gap = 3,
    anchors = [],
  }: ArrangeOptions,
): Glide | null {
  // React Flow's own measurements, in case the nodes' state has yet to catch up.
  const start = flow.getNodes().map((node) => ({
    ...node,
    measured: flow.getInternalNode(node.id)?.measured ?? node.measured,
  }));
  const lined = groups === "off" ? start : lineUpGroups(start, grid, groups);
  const boxed = boxGroups(lined, grid);
  const end = separate ? separateGroups(boxed, anchors, grid, gap) : boxed;

  const from = new Map(start.map((node) => [node.id, node.position]));
  const to = new Map<string, XYPosition>();
  for (const node of end) {
    const was = from.get(node.id);
    if (was && (was.x !== node.position.x || was.y !== node.position.y))
      to.set(node.id, node.position);
  }
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (to.size === 0 || still) {
    flow.setNodes(end);
    return null;
  }
  // A group and its nodes move in step, so nothing drifts on the way.
  const at = (id: string, progress: number) => {
    const a = from.get(id);
    const b = to.get(id);
    return a && b
      ? { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress }
      : undefined;
  };
  flow.setNodes(
    end.map((node) => ({ ...node, position: at(node.id, 0) ?? node.position })),
  );
  return animate(0, 1, {
    ...GLIDE,
    onUpdate: (progress) =>
      flow.setNodes((nodes) =>
        nodes.map((node) => {
          const position = at(node.id, progress);
          return position ? { ...node, position } : node;
        }),
      ),
  });
}

type ArrangementProps = Required<
  Pick<ArrangeOptions, "grid" | "groups" | "separate" | "gap">
> & { glideRef: React.RefObject<Glide | null> };

type Sizes = Map<string, string>;

/** The measured size of every node inside a group, by its id. */
function childSizes({ nodeLookup }: ReactFlowState) {
  const sizes: Sizes = new Map();
  for (const [id, node] of nodeLookup)
    if (node.parentId !== undefined)
      sizes.set(id, `${node.measured.width}x${node.measured.height}`);
  return sizes;
}

const sameSizes = (a: Sizes, b: Sizes) =>
  a.size === b.size && [...a].every(([id, size]) => b.get(id) === size);

/**
 * Arranges the groups once the nodes are measured, and again when an option
 * changes or a node inside a group changes size.
 */
function Arrangement({
  glideRef,
  grid,
  groups,
  separate,
  gap,
}: ArrangementProps) {
  const flow = useReactFlow();
  const measured = useNodesInitialized();
  const sizes = useStore(childSizes, sameSizes);
  const arranged = useRef<Sizes | null>(null);
  // React Flow measures nodes outside React, so this has to wait for it.
  useEffect(() => {
    if (!measured) return;
    const before = arranged.current;
    arranged.current = sizes;
    // A drag arranges the groups itself, when it ends.
    if (flow.getNodes().some((node) => node.dragging)) return;
    // The group of a node that changed size stays put, and the rest make room.
    const anchors: string[] = [];
    for (const [id, size] of before ? sizes : []) {
      const group = flow.getNode(id)?.parentId;
      if (group !== undefined && before?.get(id) !== size) anchors.push(group);
    }
    const glide = arrangeGroups(flow, { grid, groups, separate, gap, anchors });
    glideRef.current = glide;
    return () => glide?.stop();
  }, [flow, glideRef, grid, groups, separate, gap, measured, sizes]);
  return null;
}

export interface GraphProps<
  N extends Node = Node,
  E extends Edge = Edge,
> extends ReactFlowProps<N, E> {
  /** The pitch of the grid in px: of its pattern, and of what nodes snap to. */
  grid?: number;
  /** How the grid is drawn. */
  pattern?: GraphPattern;
  /** Land nodes on the grid as they are dragged. */
  snap?: boolean;
  /** Box each group around its nodes, on the grid, and keep groups a gap apart. */
  packGrid?: boolean;
  /** The least room `packGrid` leaves between two groups, in grid cells. */
  groupGap?: number;
  /** Line each group's nodes up in a row or a column, and box the group around them. */
  packGroups?: GraphGroupPacking;
  /** The tone everything inside takes until a node, group or wire names its own. */
  tone?: GraphTone;
}

/**
 * A canvas for nodes and wires: React Flow with the theme's colours, a grid
 * and a few defaults. Every React Flow prop passes through, and anything put
 * inside it can use React Flow's hooks.
 */
export function Graph<N extends Node = Node, E extends Edge = Edge>({
  grid = 24,
  pattern = "dots",
  snap = false,
  packGrid = false,
  groupGap = 3,
  packGroups = "off",
  tone,
  className,
  style,
  children,
  onInit,
  onNodeDragStart,
  onNodeDragStop,
  ...props
}: GraphProps<N, E>) {
  const flow = useRef<ReactFlowInstance<N, E> | null>(null);
  const glide = useRef<Glide | null>(null);
  const arrange = packGrid || packGroups !== "off";
  const options = {
    grid,
    groups: packGroups,
    separate: packGrid,
    gap: groupGap,
  };

  return (
    <ReactFlow<N, E>
      data-slot="graph"
      data-tone={tone}
      fitView
      fitViewOptions={GRAPH_FIT}
      minZoom={0.3}
      maxZoom={1.6}
      connectionRadius={38}
      snapToGrid={snap}
      snapGrid={[grid, grid]}
      {...props}
      className={cn(
        // React Flow reads its colours from these. A node type that shares a
        // name with one of its own ("group", "default") gets none of its chrome.
        "[--xy-node-border-selected:none] [--xy-node-border:none] [--xy-node-color:inherit]",
        "[--xy-attribution-background-color:transparent] [--xy-background-color:var(--graph-canvas,var(--background))] [--xy-background-pattern-color:var(--graph-grid,color-mix(in_oklab,var(--foreground)_18%,var(--background)))] [--xy-selection-background-color:color-mix(in_oklab,var(--foreground)_6%,transparent)] [--xy-selection-border:1.5px_dashed_var(--muted-foreground)]",
        className,
      )}
      style={{ ...graphToneStyle(tone), ...style }}
      onInit={(instance) => {
        flow.current = instance;
        onInit?.(instance);
      }}
      onNodeDragStart={(event, node, nodes) => {
        // Whatever is still gliding stops, so the drag starts from where it is.
        glide.current?.stop();
        onNodeDragStart?.(event, node, nodes);
      }}
      onNodeDragStop={(event, node, nodes) => {
        if (arrange && flow.current) {
          const anchors = nodes.map(
            (dragged) => dragged.parentId ?? dragged.id,
          );
          glide.current = arrangeGroups(flow.current, { ...options, anchors });
        }
        onNodeDragStop?.(event, node, nodes);
      }}
    >
      {pattern === "none" ? null : (
        <Background
          variant={PATTERNS[pattern]}
          gap={grid}
          size={pattern === "dots" ? 1.7 : undefined}
        />
      )}
      {arrange ? <Arrangement glideRef={glide} {...options} /> : null}
      {children}
    </ReactFlow>
  );
}
