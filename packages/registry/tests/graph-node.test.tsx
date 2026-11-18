import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  NodeAction,
  Node,
  NodeCard,
  NodeContent,
  NodeDescription,
  NodeExpand,
  NodeFooter,
  NodeHeader,
  NodeStatusBadge,
  NodeTitle,
} from "@/components/pipecat/graph/node";

const slot = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLElement>(`[data-slot="${name}"]`);

describe("Node", () => {
  it("exposes each part and the node's size for styling", () => {
    const { container } = render(
      <Node size="lg">
        <NodeCard>
          <NodeHeader>
            <NodeTitle>Book</NodeTitle>
            <NodeDescription>Action</NodeDescription>
            <NodeAction>More</NodeAction>
          </NodeHeader>
          <NodeContent>Body</NodeContent>
          <NodeFooter>Foot</NodeFooter>
        </NodeCard>
      </Node>,
    );

    const node = slot(container, "node");
    expect(node).toHaveAttribute("data-size", "lg");
    expect(node).not.toHaveAttribute("data-fluid");
    for (const name of [
      "node-card",
      "node-header",
      "node-title",
      "node-description",
      "node-action",
      "node-content",
      "node-footer",
    ]) {
      expect(slot(container, name)).toBeInTheDocument();
    }
  });

  it("marks a fluid node and changes nothing but its width", () => {
    const { container, rerender } = render(<Node />);
    const node = slot(container, "node");
    const fixed = [...(node?.classList ?? [])];
    expect(node).toHaveClass("w-(--node-width)");

    rerender(<Node fluid />);
    expect(node).toHaveAttribute("data-fluid");
    const fluid = [...(node?.classList ?? [])];
    expect(fluid.filter((name) => !fixed.includes(name))).toEqual(["w-full"]);
    expect(fixed.filter((name) => !fluid.includes(name))).toEqual([
      "w-(--node-width)",
    ]);
  });

  it("lets className replace a default instead of fighting it", () => {
    const { container } = render(
      <Node className="w-80 [--node-radius:0px]">
        <NodeCard className="bg-muted" />
      </Node>,
    );
    const node = slot(container, "node");
    expect(node).toHaveClass("w-80");
    expect(node).not.toHaveClass("w-(--node-width)");
    expect(node?.className).not.toContain("[--node-radius:calc(");
    expect(slot(container, "node-card")).not.toHaveClass("bg-card");
  });

  it("renders a part as another element and keeps its slot, classes and handlers", async () => {
    const fromPart = vi.fn();
    const fromElement = vi.fn();
    render(
      <NodeCard
        className="shadow-lg"
        onClick={fromPart}
        render={<section aria-label="Card" onClick={fromElement} />}
      />,
    );

    const card = screen.getByRole("region", { name: "Card" });
    expect(card.tagName).toBe("SECTION");
    expect(card).toHaveAttribute("data-slot", "node-card");
    expect(card).toHaveClass("shadow-lg", "bg-card");

    await userEvent.click(card);
    expect(fromPart).toHaveBeenCalledOnce();
    expect(fromElement).toHaveBeenCalledOnce();
  });

  it("puts a node's tone in scope, or leaves it to the tone around it", () => {
    const { container, rerender } = render(<Node tone="green" />);
    const node = slot(container, "node");
    expect(node).toHaveAttribute("data-tone", "green");
    expect(node?.style.getPropertyValue("--tone")).toContain("--graph-green");

    rerender(<Node />);
    expect(node).not.toHaveAttribute("data-tone");
    expect(node?.style.getPropertyValue("--tone")).toBe("");
  });

  it("marks a status and gives it a tone of its own, apart from the node's", () => {
    const { container, rerender } = render(<Node tone="blue" status="guard" />);
    const node = slot(container, "node");
    const statusTone = () => node?.style.getPropertyValue("--node-status");
    expect(node).toHaveAttribute("data-status", "guard");
    expect(statusTone()).toContain("--graph-amber");
    expect(node?.style.getPropertyValue("--tone")).toContain("--graph-blue");

    rerender(<Node tone="blue" status="error" />);
    expect(statusTone()).toContain("--graph-red");

    rerender(<Node tone="blue" status="error" statusTone="pink" />);
    expect(statusTone()).toContain("--graph-pink");
  });

  it("leaves an active node's status to its own tone, and an idle one unmarked", () => {
    const { container, rerender } = render(
      <Node tone="blue" status="active" />,
    );
    const node = slot(container, "node");
    expect(node).toHaveAttribute("data-status", "active");
    expect(node?.style.getPropertyValue("--node-status")).toBe("");

    rerender(<Node tone="blue" />);
    expect(node).not.toHaveAttribute("data-status");
  });

  it("styles the card from the node's status", () => {
    const { container } = render(
      <Node status="error">
        <NodeCard />
      </Node>,
    );
    expect(slot(container, "node-card")?.className).toContain(
      "group-data-[status=error]/node:ring-(--node-status)",
    );
  });

  it("says a status in words with a badge", () => {
    const { container } = render(
      <Node status="active">
        <NodeStatusBadge className="uppercase">Listening</NodeStatusBadge>
      </Node>,
    );
    const badge = slot(container, "node-status-badge");
    expect(badge).toHaveTextContent("Listening");
    expect(badge).toHaveClass("uppercase", "absolute");
  });

  it("keeps connector sizes out of the node's own variables", () => {
    const { container } = render(<Node />);
    expect(slot(container, "node")?.className).not.toContain("connector");
  });

  it("draws a subflow's stack only when asked", () => {
    const { container, rerender } = render(<Node />);
    const node = slot(container, "node");
    expect(node).toHaveAttribute("data-variant", "default");
    expect(node?.className).not.toContain("before:");

    rerender(<Node variant="subflow" />);
    expect(node).toHaveAttribute("data-variant", "subflow");
    expect(node?.className).toContain("before:bg-tone-mid/50");
    expect(node?.className).toContain("after:bg-tone-mid");
  });

  it("gives a subflow an open button that is named and clickable", async () => {
    const onOpen = vi.fn();
    render(<NodeExpand aria-label="Open Scheduling" onClick={onOpen} />);

    const button = screen.getByRole("button", { name: "Open Scheduling" });
    expect(button).toHaveAttribute("data-slot", "node-expand");
    expect(button).toHaveClass("bg-tone-soft", "text-tone-ink");
    expect(button).not.toHaveClass("bg-secondary");
    expect(button.querySelector("svg")).toBeInTheDocument();

    await userEvent.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
