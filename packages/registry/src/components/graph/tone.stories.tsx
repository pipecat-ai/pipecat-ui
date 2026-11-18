import type { Meta, StoryObj } from "@storybook/react-vite";

import { graphToneStyle } from "@/components/pipecat/graph/tone";

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
  title: "Graph/Tones",
} satisfies Meta;

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

/** Each tone is one colour; its mid, soft and ink shades are mixed from it. */
export const Palette: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {TONES.map((tone) => (
        <div key={tone} style={graphToneStyle(tone)}>
          <Swatches name={tone} />
        </div>
      ))}
    </div>
  ),
};

/** A tone holds for everything inside, until something names its own. */
export const Scope: Story = {
  render: () => (
    <div style={graphToneStyle("blue")} className="flex flex-col gap-3">
      <Swatches name="the tone around it" />
      <div style={graphToneStyle("coral")}>
        <Swatches name="a tone of its own" />
      </div>
      <Swatches name="back to the tone around it" />
    </div>
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
  "--graph-neutral": "var(--color-stone-400)",
} as React.CSSProperties;

/** Name a tone, define `--graph-<name>`, and pin any shade you want exact. */
export const OwnPalette: Story = {
  render: () => (
    <div style={OWN_PALETTE} className="flex flex-col gap-3">
      <div style={graphToneStyle("slate")}>
        <Swatches name="slate: one variable, shades mixed" />
      </div>
      <div style={graphToneStyle("brand")}>
        <Swatches name="brand: every shade pinned" />
      </div>
      <Swatches name="no tone set: neutral, retuned here" />
    </div>
  ),
};
