import type { Node, XYPosition } from "@xyflow/react";

/*
 * A group is a node with children: nodes whose `parentId` is its id. These
 * functions keep groups tidy. They only read and return nodes, so they work on
 * any graph, with or without the canvas.
 */

type Box = XYPosition & { width: number; height: number };

/** A guard against a pathological chain of pushes. */
const MAX_PUSHES = 200;

/** Room a group leaves around its nodes, in whole cells. The top is deeper, for its tag. */
const padding = (grid: number) => ({ x: grid, top: grid * 2, bottom: grid });

function sizeOf(node: Node) {
  return {
    width: node.measured?.width ?? node.width ?? node.initialWidth ?? 0,
    height: node.measured?.height ?? node.height ?? node.initialHeight ?? 0,
  };
}

export type GroupDirection = "horizontal" | "vertical";

/** Room between two nodes lined up in a group: three cells in a row, for a wire, two in a column. */
const spacing = (grid: number, direction: GroupDirection) =>
  grid * (direction === "horizontal" ? 3 : 2);

function childrenOf<N extends Node>(nodes: N[]) {
  const children = new Map<string, N[]>();
  for (const node of nodes) {
    if (node.parentId === undefined) continue;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  }
  return children;
}

/**
 * Lines each group's children up from its corner: in a row along their tops,
 * or in a column down their left edges. They keep the order they already have
 * along that line, so a node dropped past its neighbour changes places with it.
 */
export function lineUpGroups<N extends Node>(
  nodes: N[],
  grid: number,
  direction: GroupDirection,
): N[] {
  const pad = padding(grid);
  const row = direction === "horizontal";
  const placed = new Map<string, XYPosition>();
  for (const inside of childrenOf(nodes).values()) {
    const ordered = [...inside].sort((a, b) =>
      row
        ? a.position.x - b.position.x || a.position.y - b.position.y
        : a.position.y - b.position.y || a.position.x - b.position.x,
    );
    let at = row ? pad.x : pad.top;
    for (const child of ordered) {
      const { width, height } = sizeOf(child);
      placed.set(child.id, row ? { x: at, y: pad.top } : { x: pad.x, y: at });
      // The next one starts on the grid, clear of this one.
      at =
        Math.ceil((at + (row ? width : height)) / grid) * grid +
        spacing(grid, direction);
    }
  }
  return nodes.map((node) => {
    const to = placed.get(node.id);
    return to && (to.x !== node.position.x || to.y !== node.position.y)
      ? { ...node, position: to }
      : node;
  });
}

/**
 * Boxes every group around its children, on the grid, a cell clear of them.
 * The group moves and resizes, and its children shift the other way, so
 * nothing moves on screen but the group's edges. A group with no children
 * keeps the size it has.
 */
export function boxGroups<N extends Node>(nodes: N[], grid: number): N[] {
  const children = childrenOf(nodes);
  const pad = padding(grid);
  const shifts = new Map<string, XYPosition>();
  const boxes = new Map<string, Box>();

  for (const node of nodes) {
    const inside = children.get(node.id);
    if (!inside) continue;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const child of inside) {
      const { width, height } = sizeOf(child);
      left = Math.min(left, child.position.x);
      top = Math.min(top, child.position.y);
      right = Math.max(right, child.position.x + width);
      bottom = Math.max(bottom, child.position.y + height);
    }
    // The corner is rounded to the grid and the size up to whole cells.
    const x =
      Math.round((node.position.x + left - pad.x) / grid) * grid -
      node.position.x;
    const y =
      Math.round((node.position.y + top - pad.top) / grid) * grid -
      node.position.y;
    shifts.set(node.id, { x, y });
    boxes.set(node.id, {
      x: node.position.x + x,
      y: node.position.y + y,
      width: Math.ceil((right + pad.x - x) / grid) * grid,
      height: Math.ceil((bottom + pad.bottom - y) / grid) * grid,
    });
  }

  return nodes.map((node) => {
    const box = boxes.get(node.id);
    if (box) {
      const same =
        box.x === node.position.x &&
        box.y === node.position.y &&
        box.width === node.width &&
        box.height === node.height;
      return same
        ? node
        : {
            ...node,
            position: { x: box.x, y: box.y },
            width: box.width,
            height: box.height,
          };
    }
    const shift =
      node.parentId === undefined ? undefined : shifts.get(node.parentId);
    return shift && (shift.x !== 0 || shift.y !== 0)
      ? {
          ...node,
          position: {
            x: node.position.x - shift.x,
            y: node.position.y - shift.y,
          },
        }
      : node;
  });
}

/**
 * How far `b` has to move to clear `a` by the gap, the shortest way out, or
 * null if it already does.
 */
function separation(a: Box, b: Box, room: number): XYPosition | null {
  const clear =
    b.x >= a.x + a.width + room ||
    b.x + b.width + room <= a.x ||
    b.y >= a.y + a.height + room ||
    b.y + b.height + room <= a.y;
  if (clear) return null;
  const ways: XYPosition[] = [
    { x: a.x + a.width + room - b.x, y: 0 },
    { x: a.x - room - (b.x + b.width), y: 0 },
    { x: 0, y: a.y + a.height + room - b.y },
    { x: 0, y: a.y - room - (b.y + b.height) },
  ];
  return ways.reduce((best, way) =>
    Math.abs(way.x) + Math.abs(way.y) < Math.abs(best.x) + Math.abs(best.y)
      ? way
      : best,
  );
}

/**
 * Moves top-level groups apart until no two are closer than `gap` cells, edge
 * to edge: three unless told otherwise, and none at all lets them touch. Anchors
 * (the group just dragged, say) stay put and push the others; a pushed group
 * can push the next one along. With no anchors, groups hold their ground in
 * the order they come. A node outside any group is moved out of a group's way
 * but pushes nothing itself. Children ride along with their group.
 */
export function separateGroups<N extends Node>(
  nodes: N[],
  anchors: readonly string[],
  grid: number,
  gap = 3,
): N[] {
  const children = childrenOf(nodes);
  const boxes = new Map<string, Box>();
  const groups = new Set<string>();
  for (const node of nodes) {
    if (node.parentId !== undefined) continue;
    boxes.set(node.id, { ...node.position, ...sizeOf(node) });
    if (children.has(node.id) || node.type === "group") groups.add(node.id);
  }

  const room = grid * gap;
  const fixed = new Set(anchors.filter((id) => boxes.has(id)));
  const queue = [...fixed].filter((id) => groups.has(id));
  // Every group gets a turn at pushing, so two that crowd each other far from
  // an anchor are parted too.
  const waiting = [...groups].filter((id) => !fixed.has(id));
  for (let pushes = 0; pushes < MAX_PUSHES;) {
    const pusherId = queue.shift() ?? waiting.shift();
    if (pusherId === undefined) break;
    const pusher = boxes.get(pusherId);
    if (!pusher) continue;
    for (const [id, box] of boxes) {
      if (id === pusherId || fixed.has(id)) continue;
      const push = separation(pusher, box, room);
      if (!push) continue;
      boxes.set(id, { ...box, x: box.x + push.x, y: box.y + push.y });
      if (groups.has(id)) queue.push(id);
      pushes += 1;
    }
  }

  return nodes.map((node) => {
    const box = boxes.get(node.id);
    return box && (box.x !== node.position.x || box.y !== node.position.y)
      ? { ...node, position: { x: box.x, y: box.y } }
      : node;
  });
}
