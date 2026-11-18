import { describe, expect, it } from "vitest";

import { graphToneStyle } from "@/components/pipecat/graph/tone";

describe("graphToneStyle", () => {
  it("points a tone at its palette colour and the shades it may pin", () => {
    expect(graphToneStyle("green")).toEqual({
      "--tone": "var(--graph-green, var(--graph-neutral))",
      "--tone-soft": "var(--graph-green-soft)",
      "--tone-mid": "var(--graph-green-mid)",
      "--tone-ink": "var(--graph-green-ink)",
    });
  });

  it("takes a tone of your own the same way", () => {
    expect(graphToneStyle("brand-2")).toMatchObject({
      "--tone": "var(--graph-brand-2, var(--graph-neutral))",
    });
  });

  it("sets nothing without a tone, so the one around it holds", () => {
    expect(graphToneStyle(undefined)).toBeUndefined();
  });

  it("ignores a tone that is not a plain name", () => {
    expect(graphToneStyle("red); color: red; --x: (")).toBeUndefined();
    expect(graphToneStyle("")).toBeUndefined();
  });
});
