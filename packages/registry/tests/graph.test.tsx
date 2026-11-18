import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  boxGroups,
  lineUpGroups,
  separateGroups,
} from "@/components/pipecat/graph/group-layout";

const GRID = 24;

const group = (id: string, x: number, y: number, size?: number[]): Node => ({
  id,
  type: "group",
  position: { x, y },
  width: size?.[0],
  height: size?.[1],
  data: {},
});
const step = (id: string, parentId: string | undefined, x: number, y: number) =>
  ({
    id,
    parentId,
    position: { x, y },
    measured: { width: 192, height: 96 },
    data: {},
  }) satisfies Node;

const find = (nodes: Node[], id: string) => {
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new Error(`no node ${id}`);
  return node;
};

describe("boxGroups", () => {
  it("sizes a group around its children, a cell clear and two on top", () => {
    const boxed = boxGroups(
      [group("g", 0, 0), step("a", "g", 24, 48), step("b", "g", 288, 48)],
      GRID,
    );
    const g = find(boxed, "g");
    expect(g.position).toEqual({ x: 0, y: 0 });
    // 24 + 192 + 72 + 192 + 24 wide; 48 + 96 + 24 tall.
    expect([g.width, g.height]).toEqual([504, 168]);
  });

  it("moves the group, not what is on screen, when a child is dragged out", () => {
    const boxed = boxGroups(
      [group("g", 240, 120, [240, 168]), step("a", "g", -72, 0)],
      GRID,
    );
    const g = find(boxed, "g");
    const a = find(boxed, "a");
    // The child was at 168,120 on the canvas and still is.
    expect(g.position.x + a.position.x).toBe(168);
    expect(g.position.y + a.position.y).toBe(120);
    // The group's corner now sits a cell left of it and two cells above.
    expect(g.position).toEqual({ x: 144, y: 72 });
    expect(a.position).toEqual({ x: 24, y: 48 });
  });

  it("lands on the grid and leaves an empty group and loose nodes alone", () => {
    const empty = group("empty", 10, 10, [288, 216]);
    const loose = step("loose", undefined, 7, 7);
    const boxed = boxGroups(
      [group("g", 5, 5), step("a", "g", 30, 50), empty, loose],
      GRID,
    );
    const g = find(boxed, "g");
    expect(g.position.x % GRID).toBe(0);
    expect(g.position.y % GRID).toBe(0);
    expect((g.width ?? 0) % GRID).toBe(0);
    expect(find(boxed, "empty")).toBe(empty);
    expect(find(boxed, "loose")).toBe(loose);
  });
});

describe("lineUpGroups", () => {
  // Dropped out of order, at odd heights: b is leftmost and lowest.
  const scattered = () => [
    group("g", 0, 0),
    step("a", "g", 300, 10),
    step("b", "g", 20, 400),
    step("c", "g", 310, 200),
  ];
  const at = (nodes: Node[], id: string) => find(nodes, id).position;

  it("lines a group's nodes up in a row, by their tops, in the order they sit", () => {
    const row = lineUpGroups(scattered(), GRID, "horizontal");
    // A cell in and two down, then each node's width and three cells on.
    expect(at(row, "b")).toEqual({ x: 24, y: 48 });
    expect(at(row, "a")).toEqual({ x: 24 + 192 + 72, y: 48 });
    expect(at(row, "c")).toEqual({ x: 24 + (192 + 72) * 2, y: 48 });
  });

  it("stacks them in a column, by their left edges, top to bottom", () => {
    const column = lineUpGroups(scattered(), GRID, "vertical");
    // Each node's height and two cells down.
    expect(at(column, "a")).toEqual({ x: 24, y: 48 });
    expect(at(column, "c")).toEqual({ x: 24, y: 48 + 96 + 48 });
    expect(at(column, "b")).toEqual({ x: 24, y: 48 + (96 + 48) * 2 });
  });

  it("leaves the group and loose nodes where they are", () => {
    const loose = step("loose", undefined, 5, 5);
    const nodes = [...scattered(), loose];
    const row = lineUpGroups(nodes, GRID, "horizontal");
    expect(find(row, "g")).toBe(nodes[0]);
    expect(find(row, "loose")).toBe(loose);
  });
});

describe("separateGroups", () => {
  const gap = GRID * 3;

  it("pushes a crowded group the shortest way out, and leaves the anchor", () => {
    const packed = separateGroups(
      [group("a", 0, 0, [240, 168]), group("b", 192, 0, [240, 168])],
      ["a"],
      GRID,
    );
    expect(find(packed, "a").position).toEqual({ x: 0, y: 0 });
    expect(find(packed, "b").position).toEqual({ x: 240 + gap, y: 0 });
  });

  it("keeps groups as many cells apart as it is asked to, down to touching", () => {
    const nodes = [
      group("a", 0, 0, [240, 168]),
      group("b", 192, 0, [240, 168]),
    ];
    const x = (cells: number) =>
      find(separateGroups(nodes, ["a"], GRID, cells), "b").position.x;
    expect(x(0)).toBe(240);
    expect(x(1)).toBe(240 + GRID);
    expect(x(5)).toBe(240 + GRID * 5);

    // With no gap, groups that only touch are left alone.
    const touching = [
      group("a", 0, 0, [240, 168]),
      group("b", 240, 0, [240, 168]),
    ];
    expect(separateGroups(touching, ["a"], GRID, 0)[1]).toBe(touching[1]);
  });

  it("lets a pushed group push the next one along", () => {
    const packed = separateGroups(
      [
        group("a", 0, 0, [240, 168]),
        group("b", 192, 0, [240, 168]),
        group("c", 480, 0, [240, 168]),
      ],
      ["a"],
      GRID,
    );
    const b = find(packed, "b").position.x;
    expect(find(packed, "c").position.x).toBe(b + 240 + gap);
  });

  it("moves a loose node out of a group's way, but never a group out of a node's", () => {
    const nodes = [group("a", 0, 0, [240, 168]), step("n", undefined, 264, 24)];
    const pushed = separateGroups(nodes, ["a"], GRID);
    expect(find(pushed, "n").position.x).toBe(240 + gap);

    const held = separateGroups(nodes, ["n"], GRID);
    expect(find(held, "a").position).toEqual({ x: 0, y: 0 });
    expect(find(held, "n").position).toEqual({ x: 264, y: 24 });
  });

  it("parts every crowded pair when nothing is anchored", () => {
    const packed = separateGroups(
      [
        group("a", 0, 0, [240, 168]),
        group("b", 96, 0, [240, 168]),
        group("c", 2000, 0, [240, 168]),
        group("d", 2096, 0, [240, 168]),
      ],
      [],
      GRID,
    );
    const x = (id: string) => find(packed, id).position.x;
    expect(x("b") - x("a")).toBeGreaterThanOrEqual(240 + gap);
    expect(x("d") - x("c")).toBeGreaterThanOrEqual(240 + gap);
  });

  it("goes by the size a group was just boxed to, not the one last measured", () => {
    // On the canvas a group still carries its old measurement when it is boxed.
    const measured = (node: Node, width: number, height: number) => ({
      ...node,
      measured: { width, height },
    });
    const nodes = [
      measured(group("a", 0, 0), 288, 192),
      step("a1", "a", 24, 48),
      step("a2", "a", 48, 48),
      step("a3", "a", 72, 48),
      measured(group("b", 480, 0, [240, 168]), 240, 168),
    ];
    const boxed = boxGroups(lineUpGroups(nodes, GRID, "horizontal"), GRID);
    const a = find(boxed, "a");
    // Three nodes in a row: 24 + 192 + 72 + 192 + 72 + 192 + 24 wide.
    expect([a.width, a.height]).toEqual([768, 168]);

    // `b` sat inside the wider `a`, and the shortest way clear of it is down.
    const parted = separateGroups(boxed, ["a"], GRID);
    expect(find(parted, "b").position).toEqual({ x: 480, y: 168 + gap });
  });

  it("returns the same nodes when nothing has to move", () => {
    const nodes = [
      group("a", 0, 0, [240, 168]),
      group("b", 480, 0, [240, 168]),
    ];
    const packed = separateGroups(nodes, ["a"], GRID);
    expect(packed[0]).toBe(nodes[0]);
    expect(packed[1]).toBe(nodes[1]);
  });
});
