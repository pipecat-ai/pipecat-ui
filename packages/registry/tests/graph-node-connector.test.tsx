import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GraphNode } from "@/components/pipecat/graph/node";
import {
  NodeConnector,
  NodeConnectorLabel,
  NodeConnectorPort,
  NodeConnectorsLeft,
  NodeConnectorsRight,
} from "@/components/pipecat/graph/node-connector";

const all = (container: HTMLElement, name: string) => [
  ...container.querySelectorAll<HTMLElement>(`[data-slot="${name}"]`),
];

describe("NodeConnector", () => {
  it("exposes each part and the side of each area for styling", () => {
    const { container } = render(
      <GraphNode>
        <NodeConnectorsLeft>
          <NodeConnector>
            <NodeConnectorPort />
          </NodeConnector>
        </NodeConnectorsLeft>
        <NodeConnectorsRight>
          <NodeConnector>
            <NodeConnectorPort />
            <NodeConnectorLabel>Booked</NodeConnectorLabel>
          </NodeConnector>
        </NodeConnectorsRight>
      </GraphNode>,
    );

    expect(
      all(container, "node-connectors").map((area) =>
        area.getAttribute("data-side"),
      ),
    ).toEqual(["left", "right"]);
    expect(all(container, "node-connector")).toHaveLength(2);
    expect(all(container, "node-connector-port")).toHaveLength(2);
    expect(all(container, "node-connector-label")).toHaveLength(1);
  });

  it("declares its own variables on the area, where className replaces them", () => {
    const { container } = render(
      <>
        <NodeConnectorsLeft />
        <NodeConnectorsRight className="[--node-connector-port:1rem]" />
      </>,
    );
    const [left, right] = all(container, "node-connectors");
    for (const name of ["height", "port", "text", "max-width"]) {
      expect(left?.className).toContain(`[--node-connector-${name}:`);
    }
    expect(right).toHaveClass("[--node-connector-port:1rem]");
    expect(right?.className).not.toContain("[--node-connector-port:calc(");
  });

  it("takes the node's tone unless it is given its own", () => {
    const { container } = render(
      <GraphNode tone="green">
        <NodeConnectorsRight>
          <NodeConnector>
            <NodeConnectorPort />
          </NodeConnector>
          <NodeConnector tone="coral">
            <NodeConnectorPort />
          </NodeConnector>
        </NodeConnectorsRight>
      </GraphNode>,
    );
    const [inherits, own] = all(container, "node-connector");
    expect(inherits).not.toHaveAttribute("data-tone");
    expect(inherits?.style.getPropertyValue("--graph-tone")).toBe("");
    expect(own).toHaveAttribute("data-tone", "coral");
    expect(own?.style.getPropertyValue("--graph-tone")).toContain(
      "--graph-coral",
    );
  });

  it("exposes a port's shape and style, and a connector in use", () => {
    const { container, rerender } = render(
      <NodeConnector>
        <NodeConnectorPort />
        <NodeConnectorPort shape="diamond" variant="dashed" />
        <NodeConnectorPort variant="solid" />
      </NodeConnector>,
    );
    const [connector] = all(container, "node-connector");
    expect(connector).not.toHaveAttribute("data-active");

    const [plain, dashed, solid] = all(container, "node-connector-port");
    expect(plain).toHaveAttribute("data-shape", "circle");
    expect(plain).toHaveAttribute("data-variant", "outline");
    expect(plain).toHaveClass("rounded-full", "bg-card", "border-graph-tone");
    // The halo on hover is there by default, in the port's tone.
    expect(plain).toHaveClass("hover:outline-graph-tone/30");
    expect(dashed).toHaveAttribute("data-shape", "diamond");
    expect(dashed).toHaveClass("rotate-45", "border-dashed");
    expect(dashed).not.toHaveClass("rounded-full");
    expect(solid).toHaveClass("bg-graph-tone");
    expect(solid).not.toHaveClass("bg-card");

    rerender(<NodeConnector active />);
    expect(connector).toHaveAttribute("data-active");
  });
});
