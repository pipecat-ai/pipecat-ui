import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarClockIcon, EllipsisIcon } from "lucide-react";
import { motion } from "motion/react";

import {
  NodeAction,
  Node,
  type NodeProps,
  NodeCard,
  NodeContent,
  NodeDescription,
  NodeExpand,
  NodeFooter,
  NodeHeader,
  NodeStatusBadge,
  NodeTitle,
} from "@/components/pipecat/graph/node";
import {
  NodeConnector,
  NodeConnectorLabel,
  NodeConnectorPort,
  NodeConnectorsLeft,
  NodeConnectorsRight,
} from "@/components/pipecat/graph/node-connector";
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
const STATUSES = ["idle", "active", "guard", "error"] as const;
const OUTPUTS = ["Booked", "No slots", "Declined"] as const;

const meta = {
  title: "Graph/Node",
  component: Node,
  args: {
    size: "md",
    fluid: false,
    variant: "default",
    tone: "neutral",
    status: "idle",
  },
  argTypes: {
    size: { control: "inline-radio", options: SIZES },
    variant: { control: "inline-radio", options: ["default", "subflow"] },
    tone: { control: "select", options: TONES },
    status: { control: "inline-radio", options: STATUSES },
    statusTone: { control: "select", options: [undefined, ...TONES] },
    render: { control: false },
  },
} satisfies Meta<typeof Node>;

export default meta;
type Story = StoryObj<typeof meta>;

function ExampleNode({
  outputs = OUTPUTS,
  badge,
  ...props
}: NodeProps & { outputs?: readonly string[]; badge?: React.ReactNode }) {
  const subflow = props.variant === "subflow";
  const shape = subflow ? "diamond" : "circle";
  return (
    <Node {...props}>
      <NodeCard>
        <NodeHeader>
          <NodeTitle>Book appointment</NodeTitle>
          <NodeDescription className="text-tone-ink">
            {subflow ? "Subflow" : "Action"}
          </NodeDescription>
          <NodeAction>
            {subflow ? (
              <NodeExpand aria-label="Open Book appointment" />
            ) : (
              <Button variant="ghost" size="icon-xs" aria-label="Node options">
                <EllipsisIcon />
              </Button>
            )}
          </NodeAction>
        </NodeHeader>
        <NodeConnectorsLeft>
          <NodeConnector>
            <NodeConnectorPort shape={shape} />
          </NodeConnector>
        </NodeConnectorsLeft>
        <NodeContent>
          <NodeDescription>
            Holds the slot the caller chose and confirms it.
          </NodeDescription>
        </NodeContent>
        <NodeConnectorsRight>
          {outputs.map((output) => (
            <NodeConnector key={output}>
              <NodeConnectorPort shape={shape} />
              <NodeConnectorLabel>{output}</NodeConnectorLabel>
            </NodeConnector>
          ))}
        </NodeConnectorsRight>
        <NodeFooter>
          <NodeDescription>needs patient · slot</NodeDescription>
        </NodeFooter>
      </NodeCard>
      {badge ? <NodeStatusBadge>{badge}</NodeStatusBadge> : null}
    </Node>
  );
}

export const Basic: Story = {
  render: (args) => <ExampleNode {...args} />,
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-8">
      {SIZES.map((size) => (
        <ExampleNode key={size} {...args} size={size} />
      ))}
    </div>
  ),
};

const FLUID_WIDTHS = ["12rem", "18rem", "28rem"] as const;

/** One markup at three widths: the content takes the slack, nothing rescales. */
export const Fluid: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-8">
      {FLUID_WIDTHS.map((width) => (
        <div key={width} style={{ width }}>
          <ExampleNode {...args} fluid />
        </div>
      ))}
    </div>
  ),
};

/** One markup in every palette tone: the ports and the kind word follow it. */
export const Tones: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-start gap-8">
      {TONES.map((tone) => (
        <ExampleNode key={tone} {...args} tone={tone} outputs={["Next"]} />
      ))}
    </div>
  ),
};

/** A note beside the badge's word: a timing, the guard that fired, the error. */
const note = (text: string) => (
  <span className="font-normal opacity-70"> {text}</span>
);

/**
 * What a node shows while a call is at it. Three are `active` in a tone each,
 * the middle one the node's own; a guard and an error bring theirs.
 */
export const Statuses: Story = {
  args: { tone: "blue" },
  render: (args) => (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-10 pt-4">
      <ExampleNode {...args} outputs={["Next"]} />
      <ExampleNode
        {...args}
        outputs={["Next"]}
        status="active"
        statusTone="coral"
        badge={<>Listening{note("420 ms")}</>}
      />
      <ExampleNode
        {...args}
        outputs={["Next"]}
        status="active"
        badge={<>Speaking{note("1.2 s")}</>}
      />
      <ExampleNode
        {...args}
        outputs={["Next"]}
        status="active"
        statusTone="green"
        badge={<>Thinking{note("310 ms")}</>}
      />
      <ExampleNode
        {...args}
        outputs={["Next"]}
        status="guard"
        badge={<>Guard{note("Emergency")}</>}
      />
      <ExampleNode
        {...args}
        outputs={["Next"]}
        status="error"
        badge={<>Error{note("Tool timed out")}</>}
      />
    </div>
  ),
};

/** A node that holds a graph of its own: a stack behind it, an open button, diamond ports. */
export const Subflow: Story = {
  args: { variant: "subflow", tone: "purple", size: "lg" },
  render: (args) => <ExampleNode {...args} />,
};

/*
 * A client's look, built from className, the node's variables and its own
 * palette. The colours stand in for a client theme; a real one sets them in
 * its CSS.
 */
const THEME = {
  "--background": "#f4f2ec",
  "--card": "#ffffff",
  "--card-foreground": "#1a1b1f",
  "--foreground": "#1a1b1f",
  "--muted-foreground": "#5b5a54",
  "--graph-neutral": "#b9b7ae",
  "--graph-green": "#1f9d63",
  "--graph-amber": "#e5a812",
  "--graph-coral": "#f0603a",
} as React.CSSProperties;

const EXITS = [
  { label: "Booked", tone: "green" },
  { label: "No slots", tone: "amber" },
  { label: "Declined", tone: "coral" },
] as const;
const NODE_SHADOW = "shadow-[0_14px_30px_rgb(26_27_31/0.08)]";
const CONNECTORS =
  "[--node-connector-height:--spacing(7)] [--node-connector-port:--spacing(4)]";

function ThemedNode({
  lift = false,
  ...props
}: NodeProps & { lift?: boolean }) {
  const exits = (
    <NodeConnectorsRight className={CONNECTORS}>
      {EXITS.map((exit) => (
        <NodeConnector key={exit.label} tone={exit.tone}>
          <NodeConnectorPort />
          <NodeConnectorLabel className="font-mono font-semibold">
            {exit.label}
          </NodeConnectorLabel>
        </NodeConnector>
      ))}
    </NodeConnectorsRight>
  );
  const entry = (
    <NodeConnectorsLeft className={CONNECTORS}>
      <NodeConnector tone="neutral">
        <NodeConnectorPort />
      </NodeConnector>
    </NodeConnectorsLeft>
  );
  return (
    <Node
      {...props}
      tone="green"
      className="min-h-44 [--node-radius:--spacing(6.5)] [--node-text-description:--spacing(2.5)]"
    >
      <NodeCard
        className={`ring-0 ${NODE_SHADOW}`}
        // With `lift`, only the card moves: the ports stay on the node's box.
        render={
          lift ? (
            <motion.div
              whileHover={{ scale: 1.05, rotate: -1.5 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            />
          ) : undefined
        }
      >
        <NodeHeader className="min-h-9 py-0 pt-1.5 pr-1.5 pl-3.5">
          <NodeDescription className="text-tone-ink font-mono font-bold tracking-[0.12em] uppercase">
            Book
          </NodeDescription>
        </NodeHeader>
        {lift ? null : entry}
        <NodeContent className="items-center justify-center px-3 py-1.5">
          <span className="bg-tone-soft text-tone-ink grid size-14 place-items-center rounded-[--spacing(5.5)]">
            <CalendarClockIcon aria-hidden className="size-6.5" />
          </span>
        </NodeContent>
        {lift ? null : exits}
        <NodeFooter className="px-3.5 pt-3 pb-3.5">
          <NodeTitle className="line-clamp-2 leading-tight font-bold whitespace-normal">
            Book the appointment
          </NodeTitle>
        </NodeFooter>
      </NodeCard>
      {lift ? entry : null}
      {lift ? exits : null}
    </Node>
  );
}

export const Restyled: Story = {
  render: (args) => (
    <div
      style={THEME}
      className="bg-background flex flex-wrap items-center gap-10 rounded-xl p-12"
    >
      <ThemedNode {...args} />
      <div className="w-80">
        <ThemedNode {...args} fluid />
      </div>
    </div>
  ),
};

/** The card is its own element, so it can move without moving the ports. */
export const AnimatedCard: Story = {
  render: (args) => (
    <div style={THEME} className="bg-background rounded-xl p-12">
      <ThemedNode {...args} lift />
    </div>
  ),
};
