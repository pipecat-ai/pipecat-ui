import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Graph,
  type GraphGroupPacking,
  type GraphPattern,
} from "@/components/pipecat/graph/graph";
import {
  DEMO_EDGE_TYPES,
  DEMO_NODE_TYPES,
  DemoConnectionLine,
  GraphDemoControls,
  useGraphDemo,
} from "../../fixtures/graph-demo";

const PATTERNS = ["dots", "lines", "cross", "none"] as const;
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

type DemoArgs = {
  grid: number;
  pattern: GraphPattern;
  snap: boolean;
  packGrid: boolean;
  groupGap: number;
  packGroups: GraphGroupPacking;
  tone?: string;
  className?: string;
};

function Demo({ className, ...args }: DemoArgs) {
  const demo = useGraphDemo();
  return (
    <div className="h-112 w-240 max-w-[90vw] overflow-hidden rounded-xl border">
      <Graph
        {...demo}
        {...args}
        className={className}
        nodeTypes={DEMO_NODE_TYPES}
        edgeTypes={DEMO_EDGE_TYPES}
        connectionLineComponent={DemoConnectionLine}
      >
        <GraphDemoControls
          grid={args.grid}
          gap={args.groupGap}
          groups={args.packGroups}
        />
      </Graph>
    </div>
  );
}

const meta = {
  title: "Graph/Graph",
  component: Demo,
  args: {
    grid: 24,
    pattern: "dots",
    snap: true,
    packGrid: true,
    groupGap: 3,
    packGroups: "off",
  },
  argTypes: {
    grid: { control: { type: "range", min: 12, max: 48, step: 4 } },
    groupGap: { control: { type: "range", min: 0, max: 6, step: 1 } },
    packGroups: {
      control: "inline-radio",
      options: ["off", "horizontal", "vertical"],
    },
    pattern: { control: "inline-radio", options: PATTERNS },
    tone: { control: "select", options: TONES },
  },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Drag a step, a group by its tag, or a wire out of a port. */
export const Basic: Story = {
  render: (args) => <Demo {...args} />,
};

/** The same grid drawn four ways. */
export const Patterns: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-4">
      {PATTERNS.map((pattern) => (
        <div
          key={pattern}
          className="h-56 w-112 max-w-[44vw] rounded-xl border"
        >
          <Graph {...args} pattern={pattern} nodes={[]} edges={[]} />
        </div>
      ))}
    </div>
  ),
};

/** Each group lines its nodes up in a column, wherever they are dropped. */
export const PackedVertically: Story = {
  args: { packGroups: "vertical" },
  render: (args) => <Demo {...args} />,
};

/** The canvas and its grid take their colours from two variables. */
export const Colours: Story = {
  args: {
    className:
      "[--graph-canvas:var(--color-indigo-50)] [--graph-grid:var(--color-indigo-300)] dark:[--graph-canvas:var(--color-indigo-950)] dark:[--graph-grid:var(--color-indigo-700)]",
  },
  render: (args) => <Demo {...args} />,
};

/** With packing off, groups keep whatever size and place they are given. */
export const Unpacked: Story = {
  args: { packGrid: false, snap: false },
  render: (args) => <Demo {...args} />,
};
