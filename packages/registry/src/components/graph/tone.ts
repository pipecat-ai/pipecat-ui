import type { CSSProperties } from "react";

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
 * Puts a tone in scope for an element and what is inside it. `--graph-<name>`
 * is the tone's colour; `-soft`, `-mid` and `-ink` pin its shades, and any left
 * out are mixed from the colour in the theme.
 */
export function graphToneStyle(
  tone: GraphTone | undefined,
): CSSProperties | undefined {
  // A tone is spliced into a value, so anything but a plain name is ignored.
  if (tone === undefined || !/^[\w-]+$/.test(tone)) return undefined;
  return {
    "--graph-tone": `var(--graph-${tone}, var(--graph-neutral))`,
    "--graph-tone-soft": `var(--graph-${tone}-soft)`,
    "--graph-tone-mid": `var(--graph-${tone}-mid)`,
    "--graph-tone-ink": `var(--graph-${tone}-ink)`,
  } as CSSProperties;
}
