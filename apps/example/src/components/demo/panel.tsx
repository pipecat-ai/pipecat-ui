import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PanelProps {
  /** Legend printed over the top border, at the left. */
  title: string;
  /** Status printed over the top border, at the right. */
  status?: ReactNode;
  /** Note printed over the bottom border, at the left. */
  footnote?: ReactNode;
  className?: string;
  children?: ReactNode;
}

// Mask the border behind each legend.
const LEGEND =
  "absolute z-10 bg-background px-1.5 text-[13px] leading-none font-medium";

/** Bordered region; children own the padding. */
export function Panel({
  title,
  status,
  footnote,
  className,
  children,
}: PanelProps) {
  return (
    <section className={cn("border-border relative border", className)}>
      <span className={cn(LEGEND, "text-agent top-0 left-3 -translate-y-1/2")}>
        {title}
      </span>
      {status !== undefined && (
        <span className={cn(LEGEND, "top-0 right-3 -translate-y-1/2")}>
          {status}
        </span>
      )}
      {footnote !== undefined && (
        <span
          className={cn(
            LEGEND,
            "text-muted-foreground/70 bottom-0 left-3 translate-y-1/2",
          )}
        >
          {footnote}
        </span>
      )}
      {children}
    </section>
  );
}
