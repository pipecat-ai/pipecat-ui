import type { Meta, StoryObj } from "@storybook/react-vite";

import { Graph, graphToneStyle } from "@/components/pipecat/graph/graph";

const TONES = [
  "neutral",
  "blue",
  "purple",
  "amber",
  "green",
  "pink",
  "coral",
  "red",
] as const;

const meta = {
  title: "Graph/Graph",
  component: Graph,
  argTypes: {
    tone: { control: "select", options: TONES },
    render: { control: false },
  },
} satisfies Meta<typeof Graph>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The tone in scope, drawn with the four utilities a part styles itself with. */
function Swatches({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="bg-tone size-8 rounded-md" title="bg-tone" />
      <span className="bg-tone-mid size-8 rounded-md" title="bg-tone-mid" />
      <span className="bg-tone-soft size-8 rounded-md" title="bg-tone-soft" />
      <span className="text-tone-ink ml-2 text-sm font-medium">{name}</span>
    </div>
  );
}

/** Everything inside takes the graph's tone until something names its own. */
export const Basic: Story = {
  args: { tone: "blue" },
  render: (args) => (
    <Graph {...args} className="flex flex-col gap-3">
      <Swatches name="the graph's tone" />
      <div style={graphToneStyle("coral")}>
        <Swatches name="a tone of its own" />
      </div>
    </Graph>
  ),
};

/** Each tone is one colour; its mid, soft and ink shades are mixed from it. */
export const Palette: Story = {
  render: (args) => (
    <Graph {...args} className="flex flex-col gap-3">
      {TONES.map((tone) => (
        <div key={tone} style={graphToneStyle(tone)}>
          <Swatches name={tone} />
        </div>
      ))}
    </Graph>
  ),
};

/*
 * A palette of your own is a set of variables named after the tone. These sit
 * on a wrapper for the story; yours go in :root.
 */
const OWN_PALETTE = {
  "--graph-slate": "var(--color-slate-500)",
  "--graph-brand": "var(--color-teal-600)",
  "--graph-brand-mid": "var(--color-teal-300)",
  "--graph-brand-soft": "var(--color-teal-100)",
  "--graph-brand-ink": "var(--color-teal-800)",
} as React.CSSProperties;

/** Name a tone, define `--graph-<name>`, and pin any shade you want exact. */
export const OwnPalette: Story = {
  render: (args) => (
    <div style={OWN_PALETTE} className="flex flex-col gap-3">
      <Graph {...args} tone="slate">
        <Swatches name="slate: one variable, shades mixed" />
      </Graph>
      <Graph {...args} tone="brand">
        <Swatches name="brand: every shade pinned" />
      </Graph>
      <Graph {...args} tone="green" className="[--graph-green:#1f9d63]">
        <Swatches name="green, redefined for this graph" />
      </Graph>
    </div>
  ),
};
