import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  EllipsisIcon,
  GripVerticalIcon,
  LockIcon,
  PlusIcon,
} from "lucide-react";

import {
  GraphNode,
  NodeCard,
  NodeContent,
  NodeDescription,
  NodeHeader,
  type NodeSize,
  NodeTitle,
} from "@/components/pipecat/graph/node";
import {
  NodeConnector,
  NodeConnectorPort,
  NodeConnectorsLeft,
  NodeConnectorsRight,
} from "@/components/pipecat/graph/node-connector";
import {
  NodeGroup,
  NodeGroupAdd,
  NodeGroupEmpty,
  NodeGroupHandle,
  NodeGroupIsland,
  type NodeGroupProps,
  NodeGroupTag,
  NodeGroupTitle,
} from "@/components/pipecat/graph/node-group";
import type { GraphTone } from "@/components/pipecat/graph/tone";
import { Button } from "@/components/ui/button";

const SIZES = ["sm", "md", "lg", "xl"] as const;
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
  title: "Graph/Node Group",
  component: NodeGroup,
  args: { size: "md", tone: "blue", empty: false },
  argTypes: {
    size: { control: "inline-radio", options: SIZES },
    tone: { control: "select", options: TONES },
    render: { control: false },
  },
} satisfies Meta<typeof NodeGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function Step({
  title,
  kind,
  tone,
  size = "sm",
  ...props
}: {
  title: string;
  kind: string;
  tone?: GraphTone;
  size?: NodeSize;
} & React.ComponentProps<typeof GraphNode>) {
  return (
    <GraphNode size={size} tone={tone} {...props}>
      <NodeCard>
        <NodeHeader>
          <NodeTitle>{title}</NodeTitle>
          <NodeDescription className="text-graph-tone-ink">
            {kind}
          </NodeDescription>
        </NodeHeader>
        <NodeConnectorsLeft>
          <NodeConnector>
            <NodeConnectorPort />
          </NodeConnector>
        </NodeConnectorsLeft>
        <NodeContent>
          <NodeDescription>One step of the call.</NodeDescription>
        </NodeContent>
        <NodeConnectorsRight>
          <NodeConnector>
            <NodeConnectorPort />
          </NodeConnector>
        </NodeConnectorsRight>
      </NodeCard>
    </GraphNode>
  );
}

function Tag({ name, locked = false }: { name: string; locked?: boolean }) {
  return (
    <NodeGroupTag>
      <NodeGroupHandle>
        <GripVerticalIcon aria-hidden />
        <NodeGroupTitle>{name}</NodeGroupTitle>
        {locked && <LockIcon role="img" aria-label="Locked group" />}
      </NodeGroupHandle>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={`Add a step to ${name}`}
      >
        <PlusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={`Options for ${name}`}
      >
        <EllipsisIcon />
      </Button>
    </NodeGroupTag>
  );
}

function ExampleGroup({
  name = "Book it",
  ...props
}: NodeGroupProps & { name?: string }) {
  return (
    <NodeGroup {...props}>
      <Tag name={name} />
      <NodeGroupIsland className="grid-flow-col items-start gap-10">
        <Step title="Find a slot" kind="Question" />
        <Step title="Book it" kind="Action" />
      </NodeGroupIsland>
    </NodeGroup>
  );
}

/** A group hugs the nodes inside its island. */
export const Basic: Story = {
  render: (args) => (
    <div className="pt-6">
      <ExampleGroup {...args} />
    </div>
  ),
};

/** The island's padding and radius and the tag's type step together. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-10 pt-6">
      {SIZES.map((size) => (
        <NodeGroup key={size} {...args} size={size}>
          <Tag name={size} />
          <NodeGroupIsland>
            <Step title="Find a slot" kind="Question" size={size} />
          </NodeGroupIsland>
        </NodeGroup>
      ))}
    </div>
  ),
};

/** Nodes with no tone of their own take the group's. */
export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-12 pt-6">
      {TONES.map((tone) => (
        <NodeGroup key={tone} {...args} tone={tone}>
          <Tag name={tone} />
          <NodeGroupIsland>
            <Step title="Find a slot" kind="Question" />
          </NodeGroupIsland>
        </NodeGroup>
      ))}
    </div>
  ),
};

/** Nothing in it yet: an outlined island with a way to start. */
export const Empty: Story = {
  args: { empty: true, tone: "green" },
  render: (args) => (
    <div className="pt-6">
      <NodeGroup {...args}>
        <Tag name="New group" />
        <NodeGroupIsland>
          <NodeGroupEmpty>
            <NodeGroupAdd aria-label="Add a step to New group" />
            Add a step, or drop one here
          </NodeGroupEmpty>
        </NodeGroupIsland>
      </NodeGroup>
    </div>
  ),
};

/** A locked group says so in its tag; what locking does is the canvas's. */
export const Locked: Story = {
  render: (args) => (
    <div className="pt-6">
      <NodeGroup {...args}>
        <Tag name="Verify the caller" locked />
        <NodeGroupIsland>
          <Step title="Ask date of birth" kind="Question" />
        </NodeGroupIsland>
      </NodeGroup>
    </div>
  ),
};

/*
 * A client's look, built from className and the group's variables. The colours
 * stand in for a client theme; a real one sets them in its CSS.
 */
const THEME = {
  "--background": "#f4f2ec",
  "--card": "#ffffff",
  "--card-foreground": "#1a1b1f",
  "--foreground": "#1a1b1f",
  "--muted-foreground": "#5b5a54",
  "--graph-blue": "#3366e0",
  "--graph-blue-soft": "#e6edfc",
  "--graph-green": "#1f9d63",
  "--graph-green-soft": "#e2f4ea",
} as React.CSSProperties;

export const Restyled: Story = {
  render: (args) => (
    <div
      style={THEME}
      className="bg-background flex flex-wrap items-start gap-12 rounded-xl p-12"
    >
      {(["blue", "green"] as const).map((tone) => (
        <NodeGroup
          key={tone}
          {...args}
          tone={tone}
          className="[--node-group-radius:--spacing(8.5)]"
        >
          <NodeGroupTag className="shadow-[0_4px_12px_rgb(26_27_31/0.08)] ring-0">
            <NodeGroupHandle>
              <GripVerticalIcon aria-hidden />
              <NodeGroupTitle className="font-bold">
                {tone === "blue" ? "Answer" : "Book it"}
              </NodeGroupTitle>
            </NodeGroupHandle>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Add a step"
            >
              <PlusIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label="Group options"
            >
              <EllipsisIcon />
            </Button>
          </NodeGroupTag>
          <NodeGroupIsland>
            <Step title="Find a slot" kind="Question" tone={tone} />
          </NodeGroupIsland>
        </NodeGroup>
      ))}
    </div>
  ),
};
