"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@/lib/utils";

/** A tone of the palette that ships, or the name of one of your own. */
export type GraphTone =
  | "neutral"
  | "blue"
  | "purple"
  | "amber"
  | "green"
  | "pink"
  | "coral"
  | "red"
  | (string & {});

/**
 * Puts a tone in scope for an element and everything inside it. A tone is a
 * name: `--graph-<name>` is its colour, and `-soft`, `-mid` and `-ink` are
 * shades a palette may pin. A shade it leaves out is mixed from the colour in
 * the theme, so a palette of your own is as little as one variable.
 */
export function graphToneStyle(
  tone: GraphTone | undefined,
): React.CSSProperties | undefined {
  // A tone is spliced into a value, so anything but a plain name is ignored.
  if (tone === undefined || !/^[\w-]+$/.test(tone)) return undefined;
  return {
    "--tone": `var(--graph-${tone}, var(--graph-neutral))`,
    "--tone-soft": `var(--graph-${tone}-soft)`,
    "--tone-mid": `var(--graph-${tone}-mid)`,
    "--tone-ink": `var(--graph-${tone}-ink)`,
  } as React.CSSProperties;
}

export interface GraphProps extends useRender.ComponentProps<"div"> {
  /** The tone everything inside takes until a node or a connector names its own. */
  tone?: GraphTone;
}

/**
 * The container a graph's nodes share. For now it scopes a tone and is where
 * one graph overrides the palette; the canvas and the wires come later.
 */
export function Graph({ tone, className, render, ...props }: GraphProps) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn("relative", className),
        style: graphToneStyle(tone),
      },
      props,
    ),
    state: { slot: "graph", tone },
  });
}
