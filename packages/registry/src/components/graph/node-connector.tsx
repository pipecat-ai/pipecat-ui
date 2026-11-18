"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import {
  type GraphTone,
  graphToneStyle,
} from "@/components/pipecat/graph/graph";
import { cn } from "@/lib/utils";

/*
 * A connector area fills the `left` or `right` column of a node. Its sizes
 * come from the node's type, so connectors follow the node's size, and are
 * declared here: set any of them on the area to change it.
 */
const nodeConnectorsVariants = cva(
  [
    // Raised, so ports stay over the card when the area sits beside it.
    "group/node-connectors relative z-1 flex max-w-(--node-connector-max-width) min-w-0 flex-col justify-center py-(--node-py) group-has-data-[slot=node-footer]/node:pb-0 group-has-data-[slot=node-header]/node:pt-0",
    "[--node-connector-height:calc(var(--node-text)*2_-_var(--spacing))] [--node-connector-port:calc(var(--node-text)_-_var(--spacing)/2)] [--node-connector-text:var(--node-text-description)]",
    // Labels truncate at two fifths of the size's own width, however wide a fluid node is.
    "[--node-connector-max-width:calc(var(--node-width)*0.4)]",
  ],
  {
    variants: {
      side: {
        left: "[grid-area:left]",
        right: "[grid-area:right]",
      },
    },
  },
);

export type NodeConnectorsProps = useRender.ComponentProps<"div">;

function NodeConnectors({
  side,
  className,
  render,
  ...props
}: NodeConnectorsProps & { side: "left" | "right" }) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      { className: cn(nodeConnectorsVariants({ side }), className) },
      props,
    ),
    state: { slot: "node-connectors", side },
  });
}

/** The connectors on the node's left edge, level with its content. */
export function NodeConnectorsLeft(props: NodeConnectorsProps) {
  return <NodeConnectors side="left" {...props} />;
}

/** The connectors on the node's right edge, level with its content. */
export function NodeConnectorsRight(props: NodeConnectorsProps) {
  return <NodeConnectors side="right" {...props} />;
}

export interface NodeConnectorProps extends useRender.ComponentProps<"div"> {
  /** The connector's own tone, for its port and label. Defaults to the node's. */
  tone?: GraphTone;
  /** The connector in use: its port fills and its label is tinted. */
  active?: boolean;
}

/** One row of a connector area: a port, with or without a label. */
export function NodeConnector({
  tone,
  active = false,
  className,
  render,
  ...props
}: NodeConnectorProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          // The port takes no room, so the gap is the label's distance from the
          // node's edge: the node's own inline padding.
          "group/node-connector flex min-h-(--node-connector-height) w-full min-w-0 items-center gap-(--node-px) group-data-[side=right]/node-connectors:justify-end",
          className,
        ),
        style: graphToneStyle(tone),
      },
      props,
    ),
    state: { slot: "node-connector", tone, active },
  });
}

const nodeConnectorPortVariants = cva(
  [
    "border-tone bg-card order-first -mx-[calc(var(--node-connector-port)/2)] size-(--node-connector-port) shrink-0 border-2",
    // A halo in the port's tone on hover, so it reads as something to grab.
    "outline-4 outline-transparent transition-[outline-color] hover:outline-tone/30",
    "group-data-[side=right]/node-connectors:order-last",
    "group-data-active/node-connector:bg-tone group-data-active/node-connector:border-solid",
  ],
  {
    variants: {
      shape: {
        circle: "rounded-full",
        diamond: "rotate-45 rounded-[calc(var(--node-connector-port)/6)]",
      },
      variant: {
        outline: "",
        dashed: "border-dashed",
        solid: "bg-tone",
      },
    },
    defaultVariants: { shape: "circle", variant: "outline" },
  },
);

export interface NodeConnectorPortProps
  extends
    useRender.ComponentProps<"span">,
    VariantProps<typeof nodeConnectorPortVariants> {}

/**
 * Where a wire ends. It sits on the outer edge of its area, centred on the
 * edge of the card, wherever it comes in the markup. It is placed with margins
 * and takes no width, so its transform is free to animate.
 */
export function NodeConnectorPort({
  shape = "circle",
  variant = "outline",
  className,
  render,
  ...props
}: NodeConnectorPortProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(
      {
        className: cn(nodeConnectorPortVariants({ shape, variant }), className),
      },
      props,
    ),
    state: { slot: "node-connector-port", shape, variant },
  });
}

export type NodeConnectorLabelProps = useRender.ComponentProps<"span">;

export function NodeConnectorLabel({
  className,
  render,
  ...props
}: NodeConnectorLabelProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(
      {
        className: cn(
          "text-muted-foreground group-data-active/node-connector:bg-tone-soft group-data-active/node-connector:text-tone-ink -mx-1 min-w-0 truncate rounded-sm px-1 text-(length:--node-connector-text) leading-snug",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-connector-label" },
  });
}
