"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { PlusIcon } from "lucide-react";

import {
  type GraphTone,
  graphToneStyle,
} from "@/components/pipecat/graph/graph";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * The root paints nothing: it is the box a canvas places and the scope its
 * parts read their sizes and tone from. That lets a canvas draw the island
 * under its nodes and the tag over them, each in a root of its own.
 */
const nodeGroupVariants = cva("group/node-group relative grid w-fit", {
  variants: {
    size: {
      sm: "[--node-group-px:--spacing(4)] [--node-group-py:--spacing(4)] [--node-group-radius:calc(var(--radius)*2.2)] [--node-group-text:--spacing(3)]",
      md: "[--node-group-px:--spacing(6)] [--node-group-py:--spacing(6)] [--node-group-radius:calc(var(--radius)*2.6)] [--node-group-text:--spacing(3.5)]",
      lg: "[--node-group-px:--spacing(8)] [--node-group-py:--spacing(8)] [--node-group-radius:calc(var(--radius)*3)] [--node-group-text:--spacing(4)]",
      xl: "[--node-group-px:--spacing(10)] [--node-group-py:--spacing(10)] [--node-group-radius:calc(var(--radius)*3.4)] [--node-group-text:--spacing(4.5)]",
    },
  },
  defaultVariants: { size: "md" },
});

export type NodeGroupSize = NonNullable<
  VariantProps<typeof nodeGroupVariants>["size"]
>;

export interface NodeGroupProps extends useRender.ComponentProps<"div"> {
  /** The island's padding and radius, and the tag's type. */
  size?: NodeGroupSize;
  /** The palette tone of the island, the tag's dot and everything inside. */
  tone?: GraphTone;
  /** A group with nothing in it yet: the island is outlined, waiting for a node. */
  empty?: boolean;
}

/**
 * A group of nodes. It hugs what is inside it, or takes a width and height
 * from a canvas that works them out.
 */
export function NodeGroup({
  size = "md",
  tone,
  empty = false,
  className,
  render,
  ...props
}: NodeGroupProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(nodeGroupVariants({ size }), className),
        style: graphToneStyle(tone),
      },
      props,
    ),
    state: { slot: "node-group", size, tone, empty },
  });
}

export type NodeGroupIslandProps = useRender.ComponentProps<"div">;

/**
 * The tinted region behind a group's nodes. Put the nodes inside it, or leave
 * it bare and let the group's box size it. The top is deeper, for the tag.
 */
export function NodeGroupIsland({
  className,
  render,
  ...props
}: NodeGroupIslandProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "bg-tone-soft grid min-w-0 rounded-(--node-group-radius) px-(--node-group-px) pt-[calc(var(--node-group-py)*2)] pb-(--node-group-py)",
          // An outline, so an empty group is the same size as a full one, and
          // even padding, so what it shows sits in the island's centre.
          "outline-tone-mid group-data-empty/node-group:min-h-54 group-data-empty/node-group:min-w-72 group-data-empty/node-group:pt-(--node-group-py) group-data-empty/node-group:outline-2 group-data-empty/node-group:-outline-offset-2 group-data-empty/node-group:outline-dashed",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-group-island" },
  });
}

export type NodeGroupTagProps = useRender.ComponentProps<"div">;

/** The group's name tag. It straddles the top edge, a little in from the corner. */
export function NodeGroupTag({
  className,
  render,
  ...props
}: NodeGroupTagProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "bg-card text-card-foreground ring-foreground/10 absolute top-0 left-[calc(var(--node-group-px)-var(--spacing)*2)] z-1 flex -translate-y-1/2 items-center gap-0.5 rounded-full p-1 text-(length:--node-group-text) leading-snug whitespace-nowrap shadow-sm ring-1",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-group-tag" },
  });
}

export type NodeGroupHandleProps = useRender.ComponentProps<"span">;

/**
 * The part of the tag a group is dragged by: a grip and its name. It only
 * looks grabbable; the dragging is the canvas's.
 */
export function NodeGroupHandle({
  className,
  render,
  ...props
}: NodeGroupHandleProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(
      {
        className: cn(
          "[&_svg]:text-muted-foreground flex cursor-grab items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1 active:cursor-grabbing [&_svg]:size-[calc(var(--node-group-text)+var(--spacing)/2)] [&_svg]:shrink-0",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-group-handle" },
  });
}

export type NodeGroupTitleProps = useRender.ComponentProps<"span">;

/** The group's name, after a dot in its tone. */
export function NodeGroupTitle({
  className,
  render,
  ...props
}: NodeGroupTitleProps) {
  return useRender({
    defaultTagName: "span",
    render,
    props: mergeProps<"span">(
      {
        className: cn(
          "font-heading before:bg-tone flex items-center gap-1.5 font-semibold before:size-[calc(var(--node-group-text)-var(--spacing))] before:shrink-0 before:rounded-full",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-group-title" },
  });
}

export type NodeGroupEmptyProps = useRender.ComponentProps<"div">;

/** What an empty group shows in the middle of its island: a button, a hint. */
export function NodeGroupEmpty({
  className,
  render,
  ...props
}: NodeGroupEmptyProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          // Centred in the island however the island lays out its nodes.
          "text-tone-ink flex flex-col items-center justify-center gap-2 place-self-center text-center text-[length:calc(var(--node-group-text)-var(--spacing)/2)] leading-snug font-medium",
          className,
        ),
      },
      props,
    ),
    state: { slot: "node-group-empty" },
  });
}

export type NodeGroupAddProps = React.ComponentProps<typeof Button>;

/**
 * The button an empty group starts from, in the group's tone: dashed at rest,
 * tinted under the pointer, filled while it has something open. It goes in
 * `NodeGroupEmpty`; say what it adds with `aria-label`.
 */
export function NodeGroupAdd({
  className,
  children,
  ...props
}: NodeGroupAddProps) {
  return (
    <Button
      variant="outline"
      size="icon-lg"
      {...props}
      data-slot="node-group-add"
      className={cn(
        "border-tone bg-card text-tone-ink size-[calc(var(--node-group-text)*4)] rounded-full border-2 border-dashed [&_svg:not([class*='size-'])]:size-[calc(var(--node-group-text)+var(--spacing)*2.5)]",
        "hover:bg-tone-mid/40 hover:text-tone-ink hover:border-solid",
        "aria-expanded:bg-tone aria-expanded:text-card aria-expanded:border-solid",
        // The stock outline button turns grey in dark mode; this one keeps its tone.
        "dark:border-tone dark:bg-card dark:hover:bg-tone-mid/40",
        className,
      )}
    >
      {children ?? <PlusIcon aria-hidden />}
    </Button>
  );
}
