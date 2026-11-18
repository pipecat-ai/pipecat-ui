import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  NodeGroup,
  NodeGroupAdd,
  NodeGroupEmpty,
  NodeGroupHandle,
  NodeGroupIsland,
  NodeGroupTag,
  NodeGroupTitle,
} from "@/components/pipecat/graph/node-group";

const slot = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-slot="${name}"]`);

describe("NodeGroup", () => {
  it("exposes each part and the group's size for styling", () => {
    const { container } = render(
      <NodeGroup size="lg">
        <NodeGroupTag>
          <NodeGroupHandle>
            <NodeGroupTitle>Book it</NodeGroupTitle>
          </NodeGroupHandle>
        </NodeGroupTag>
        <NodeGroupIsland>
          <NodeGroupEmpty>Drop a step here</NodeGroupEmpty>
        </NodeGroupIsland>
      </NodeGroup>,
    );

    const group = slot(container, "node-group");
    expect(group).toHaveAttribute("data-size", "lg");
    expect(group).not.toHaveAttribute("data-empty");
    for (const name of [
      "node-group-tag",
      "node-group-handle",
      "node-group-title",
      "node-group-island",
      "node-group-empty",
    ]) {
      expect(slot(container, name)).toBeInTheDocument();
    }
    expect(screen.getByText("Book it")).toBe(
      slot(container, "node-group-title"),
    );
  });

  it("puts its tone in scope, or leaves it to the tone around it", () => {
    const { container, rerender } = render(<NodeGroup tone="green" />);
    const group = slot(container, "node-group");
    expect(group).toHaveAttribute("data-tone", "green");
    expect(group?.style.getPropertyValue("--tone")).toContain("--graph-green");

    rerender(<NodeGroup />);
    expect(group).not.toHaveAttribute("data-tone");
    expect(group?.style.getPropertyValue("--tone")).toBe("");
  });

  it("marks an empty group so its island is outlined and centres its slate", () => {
    const { container } = render(
      <NodeGroup empty>
        <NodeGroupIsland className="items-start">
          <NodeGroupEmpty>Drop a step here</NodeGroupEmpty>
        </NodeGroupIsland>
      </NodeGroup>,
    );
    expect(slot(container, "node-group")).toHaveAttribute("data-empty");
    const island = slot(container, "node-group-island");
    expect(island?.className).toContain(
      "group-data-empty/node-group:outline-dashed",
    );
    // The deeper top padding is for the tag over nodes; an empty island drops it.
    expect(island?.className).toContain(
      "group-data-empty/node-group:pt-(--node-group-py)",
    );
    // The slate centres itself, whatever alignment the island gives its nodes.
    expect(slot(container, "node-group-empty")).toHaveClass(
      "place-self-center",
    );
  });

  it("paints nothing itself, so a tag can live in a root of its own", () => {
    const { container } = render(
      <NodeGroup tone="blue">
        <NodeGroupTag>Answer</NodeGroupTag>
      </NodeGroup>,
    );
    const group = slot(container, "node-group");
    expect(group?.className).not.toMatch(/\bbg-/);
    expect(slot(container, "node-group-island")).not.toBeInTheDocument();
    expect(slot(container, "node-group-tag")).toHaveClass("absolute");
  });

  it("takes a size from the canvas and lets className replace a default", () => {
    const { container } = render(
      <NodeGroup
        className="[--node-group-radius:2rem]"
        style={{ width: 520, height: 216 }}
      >
        <NodeGroupIsland
          className="bg-muted"
          render={<section aria-label="Island" />}
        />
      </NodeGroup>,
    );
    const group = slot(container, "node-group");
    expect(group?.style.width).toBe("520px");
    expect(group).toHaveClass("[--node-group-radius:2rem]");
    expect(group?.className).not.toContain("[--node-group-radius:calc(");

    const island = screen.getByRole("region", { name: "Island" });
    expect(island).toHaveAttribute("data-slot", "node-group-island");
    expect(island).toHaveClass("bg-muted");
    expect(island).not.toHaveClass("bg-tone-soft");
  });

  it("gives an empty group an add button that keeps to its tone", async () => {
    const onAdd = vi.fn();
    render(<NodeGroupAdd aria-label="Add a step to Book it" onClick={onAdd} />);

    const button = screen.getByRole("button", {
      name: "Add a step to Book it",
    });
    expect(button).toHaveAttribute("data-slot", "node-group-add");
    expect(button).toHaveClass("border-tone", "bg-card", "text-tone-ink");
    // Under the pointer it tints with the tone, not the stock button's grey.
    expect(button).toHaveClass("hover:bg-tone-mid/40", "hover:text-tone-ink");
    expect(button).not.toHaveClass("hover:bg-muted");
    expect(button).not.toHaveClass("hover:text-foreground");
    expect(button).not.toHaveClass("dark:hover:bg-input/50");
    expect(button.querySelector("svg")).toBeInTheDocument();

    await userEvent.click(button);
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
