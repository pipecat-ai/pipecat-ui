import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  NodeWireAction,
  wireShape,
} from "@/components/pipecat/graph/node-wire";

describe("wireShape", () => {
  it("draws a forward wire as one S-curve through the midpoint", () => {
    const shape = wireShape({ x: 0, y: 0 }, { x: 200, y: 80 });
    expect(shape.mid).toEqual({ x: 100, y: 40 });
    // It leaves and arrives level with its ports.
    expect(shape.c1.y).toBe(0);
    expect(shape.c4.y).toBe(80);
    expect(shape.c1.x).toBeGreaterThan(0);
    expect(shape.c4.x).toBeLessThan(200);
  });

  it("gives ports that are close together room to turn", () => {
    const shape = wireShape({ x: 0, y: 0 }, { x: 30, y: 0 });
    // The reach is never shorter than the minimum, so the curve bows out.
    expect(shape.c1.x).toBe(18);
    expect(shape.c4.x).toBe(12);
  });

  it("loops a backward wire out, along the gutter and in from the left", () => {
    const source = { x: 400, y: 50 };
    const target = { x: 0, y: 50 };
    const shape = wireShape(source, target, 200);
    expect(shape.c1.x).toBeGreaterThan(source.x);
    expect(shape.c4.x).toBeLessThan(target.x);
    expect([shape.c2.y, shape.mid.y, shape.c3.y]).toEqual([200, 200, 200]);
  });

  it("falls back to the line between the ports with no gutter", () => {
    const shape = wireShape({ x: 400, y: 0 }, { x: 0, y: 100 });
    expect(shape.mid).toEqual({ x: 200, y: 50 });
  });
});

describe("NodeWireAction", () => {
  it("is a named button in the wire's tone, not the stock grey", async () => {
    const onAdd = vi.fn();
    render(<NodeWireAction aria-label="Add a step" onClick={onAdd} />);

    const button = screen.getByRole("button", { name: "Add a step" });
    expect(button).toHaveAttribute("data-slot", "node-wire-action");
    expect(button).toHaveClass("border-tone", "bg-card", "text-tone-ink");
    expect(button).not.toHaveClass("hover:bg-muted");
    expect(button).not.toHaveClass("dark:bg-input/30");
    expect(button.querySelector("svg")).toBeInTheDocument();

    await userEvent.click(button);
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("takes an icon of its own", () => {
    render(
      <NodeWireAction aria-label="Cut the wire">
        <span data-testid="scissors" />
      </NodeWireAction>,
    );
    const button = screen.getByRole("button", { name: "Cut the wire" });
    expect(button.querySelector("svg")).not.toBeInTheDocument();
    expect(screen.getByTestId("scissors")).toBeInTheDocument();
  });
});
