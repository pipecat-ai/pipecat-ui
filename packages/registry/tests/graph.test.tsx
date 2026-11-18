import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Graph, graphToneStyle } from "@/components/pipecat/graph/graph";

const graph = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="graph"]');
const tone = (element: HTMLElement | null, shade = "") =>
  element?.style.getPropertyValue(`--tone${shade}`);

describe("Graph", () => {
  it("puts a tone in scope by name, with the shades its palette may pin", () => {
    const { container } = render(<Graph tone="green" />);
    const element = graph(container);
    expect(element).toHaveAttribute("data-tone", "green");
    expect(tone(element)).toBe("var(--graph-green, var(--graph-neutral))");
    expect(tone(element, "-soft")).toBe("var(--graph-green-soft)");
    expect(tone(element, "-mid")).toBe("var(--graph-green-mid)");
    expect(tone(element, "-ink")).toBe("var(--graph-green-ink)");
  });

  it("takes a tone of your own the same way", () => {
    const { container } = render(<Graph tone="brand" />);
    expect(tone(graph(container))).toBe(
      "var(--graph-brand, var(--graph-neutral))",
    );
  });

  it("inherits the tone when it is given none", () => {
    const { container } = render(<Graph />);
    expect(graph(container)).not.toHaveAttribute("data-tone");
    expect(tone(graph(container))).toBe("");
  });

  it("ignores a tone that is not a plain name", () => {
    expect(graphToneStyle("red); color: red; --x: (")).toBeUndefined();
    expect(graphToneStyle("brand-2")).toBeDefined();
  });

  it("lets style replace the tone and renders as another element", () => {
    render(
      <Graph
        tone="blue"
        style={{ "--tone": "#f0603a" } as React.CSSProperties}
        render={<section aria-label="Flow" />}
      />,
    );
    const section = screen.getByRole("region", { name: "Flow" });
    expect(section).toHaveAttribute("data-slot", "graph");
    expect(tone(section)).toBe("#f0603a");
    expect(tone(section, "-soft")).toBe("var(--graph-blue-soft)");
  });
});
