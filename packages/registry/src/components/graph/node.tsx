"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { Maximize2Icon } from "lucide-react";

import {
  type GraphTone,
  graphToneStyle,
} from "@/components/pipecat/graph/tone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * A node's sizes are variables on its root, in steps of the theme's spacing.
 * `fluid` changes the width alone: the content column takes the slack and
 * everything else keeps its size.
 */
const nodeVariants = cva(
  [
    "group/node @container/node relative isolate grid",
    "grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto]",
    "[grid-template-areas:'header_header_header'_'left_content_right'_'footer_footer_footer']",
    // The body gives up its padding on a side that meets a header or a footer.
    "[--node-body-pb:var(--node-py)] [--node-body-pt:var(--node-py)] has-data-[slot=node-footer]:[--node-body-pb:0px] has-data-[slot=node-header]:[--node-body-pt:0px]",
  ],
  {
    variants: {
      size: {
        sm: [
          "[--node-width:--spacing(48)] [--node-radius:var(--radius)]",
          "[--node-gap:--spacing(1.5)] [--node-px:--spacing(2.5)] [--node-py:--spacing(2)]",
          "[--node-text:--spacing(3)] [--node-text-header:--spacing(3)] [--node-text-description:--spacing(2.75)]",
        ],
        md: [
          "[--node-width:--spacing(60)] [--node-radius:calc(var(--radius)*1.4)]",
          "[--node-gap:--spacing(2)] [--node-px:--spacing(3)] [--node-py:--spacing(2.5)]",
          "[--node-text:--spacing(3.5)] [--node-text-header:--spacing(3.5)] [--node-text-description:--spacing(3)]",
        ],
        lg: [
          "[--node-width:--spacing(72)] [--node-radius:calc(var(--radius)*1.4)]",
          "[--node-gap:--spacing(2.5)] [--node-px:--spacing(4)] [--node-py:--spacing(3)]",
          "[--node-text:--spacing(4)] [--node-text-header:--spacing(4)] [--node-text-description:--spacing(3.5)]",
        ],
        xl: [
          "[--node-width:--spacing(88)] [--node-radius:calc(var(--radius)*1.8)]",
          "[--node-gap:--spacing(3)] [--node-px:--spacing(5)] [--node-py:--spacing(4)]",
          "[--node-text:--spacing(4.5)] [--node-text-header:--spacing(4.5)] [--node-text-description:--spacing(4)]",
        ],
      },
      fluid: {
        false: "w-(--node-width)",
        true: "w-full",
      },
      variant: {
        default: "",
        // Two cards peeking out below, in the node's tone: it holds a graph of its own.
        subflow: [
          "before:absolute before:inset-x-4 before:-bottom-3.5 before:-z-1 before:h-8 before:rounded-(--node-radius) before:bg-tone-mid/50",
          "after:absolute after:inset-x-2 after:-bottom-2 after:-z-1 after:h-8 after:rounded-(--node-radius) after:bg-tone-mid",
        ],
      },
    },
    defaultVariants: { size: "md", fluid: false, variant: "default" },
  },
);

export type NodeSize = NonNullable<VariantProps<typeof nodeVariants>["size"]>;

export interface NodeProps extends useRender.ComponentProps<"div"> {
  /** Width, padding, type and connector sizes. */
  size?: NodeSize;
  /** Fill the parent's width. Type, padding and connectors keep their size. */
  fluid?: boolean;
  /** `subflow` draws a stack of cards behind the node. */
  variant?: NonNullable<VariantProps<typeof nodeVariants>["variant"]>;
  /** The palette tone the node's parts take: ports, the stack, `bg-tone-soft`. */
  tone?: GraphTone;
}

/**
 * The node's box: its width, its sizes and the tracks its parts sit on. It
 * paints nothing and is the size container, so it needs a width from `size`
 * or its parent, never from its content.
 */
export function Node({
  size = "md",
  fluid = false,
  variant = "default",
  tone,
  className,
  render,
  ...props
}: NodeProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(nodeVariants({ size, fluid, variant }), className),
        style: graphToneStyle(tone),
      },
      props,
    ),
    state: { slot: "node", size, fluid, variant, tone },
  });
}

export type NodeCardProps = useRender.ComponentProps<"div">;

/**
 * The surface. A subgrid of the node, so parts line up whether they sit inside
 * the card or beside it. Leave overflow visible: ports straddle its edge.
 */
export function NodeCard({ className, render, ...props }: NodeCardProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          // Its own line height, so a node reads the same wherever it is placed,
          // and long words wrap rather than spill out of a fixed width.
          "bg-card text-card-foreground ring-foreground/10 relative col-span-full row-span-full grid grid-cols-subgrid grid-rows-subgrid rounded-(--node-radius) text-(length:--node-text) leading-snug wrap-break-word ring-1",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-card" },
  });
}

export type NodeHeaderProps = useRender.ComponentProps<"div">;

export function NodeHeader({ className, render, ...props }: NodeHeaderProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "grid min-w-0 auto-rows-min items-center gap-x-(--node-gap) gap-y-[calc(var(--node-gap)/4)] rounded-t-(--node-radius) px-(--node-px) py-(--node-py) text-(length:--node-text-header) [grid-area:header] has-data-[slot=node-action]:grid-cols-[minmax(0,1fr)_auto]",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-header" },
  });
}

export type NodeTitleProps = useRender.ComponentProps<"div">;

export function NodeTitle({ className, render, ...props }: NodeTitleProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn("font-heading min-w-0 truncate font-medium", className),
      },
      props,
    ),
    state: { slot: "node-title" },
  });
}

export type NodeDescriptionProps = useRender.ComponentProps<"div">;

export function NodeDescription({
  className,
  render,
  ...props
}: NodeDescriptionProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "text-muted-foreground min-w-0 text-(length:--node-text-description)",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-description" },
  });
}

export type NodeActionProps = useRender.ComponentProps<"div">;

/** Trailing controls in a header, beside the title and description. */
export function NodeAction({ className, render, ...props }: NodeActionProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "col-start-2 row-span-2 row-start-1 flex items-center gap-(--node-gap) self-start justify-self-end",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-action" },
  });
}

/** An icon-only button needs a name: one of these has to be given. */
type Named =
  | { "aria-label": string }
  | { "aria-labelledby": string }
  | { children: React.ReactNode };

export type NodeExpandProps = React.ComponentProps<typeof Button> & Named;

/**
 * The button that opens a subflow node, tinted with the node's tone. It goes
 * in `NodeAction`; name what it opens with `aria-label`.
 */
export function NodeExpand({ className, children, ...props }: NodeExpandProps) {
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      {...props}
      data-slot="node-expand"
      className={cn(
        "bg-tone-soft text-tone-ink hover:bg-tone-mid/50 aria-expanded:bg-tone-mid/50 aria-expanded:text-tone-ink",
        className,
      )}
    >
      {children ?? <Maximize2Icon aria-hidden />}
    </Button>
  );
}

export type NodeContentProps = useRender.ComponentProps<"div">;

export function NodeContent({ className, render, ...props }: NodeContentProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "flex min-w-0 flex-col gap-(--node-gap) px-(--node-px) pt-(--node-body-pt) pb-(--node-body-pb) [grid-area:content]",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-content" },
  });
}

export type NodeFooterProps = useRender.ComponentProps<"div">;

export function NodeFooter({ className, render, ...props }: NodeFooterProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "flex min-w-0 items-center gap-(--node-gap) rounded-b-(--node-radius) px-(--node-px) py-(--node-py) [grid-area:footer]",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-footer" },
  });
}
