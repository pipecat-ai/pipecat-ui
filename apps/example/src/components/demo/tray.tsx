import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface TrayProps {
  /** The button's label and the tray's accessible title. */
  label: string;
  /** Live summary printed after the label on the button (e.g. "3 req"). */
  summary?: ReactNode;
  /** One-line description for assistive tech; not rendered visibly. */
  description: string;
  /** Highlights the button when its content has something new to show. */
  active?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A bottom-bar button that slides a panel up from the bottom of the screen
 * (a shadcn Sheet). The panel's content keeps collecting while the tray is
 * closed because the stores behind it are module-level, so opening it shows
 * the session's full history.
 */
export function Tray({
  label,
  summary,
  description,
  active = false,
  className,
  children,
}: TrayProps) {
  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          "flex items-center gap-2 border px-2 py-1.5 text-[13px] font-medium tracking-[0.06em] whitespace-nowrap uppercase transition-colors sm:px-3",
          active
            ? "border-agent/70 text-foreground hover:border-agent"
            : "border-border text-muted-foreground hover:border-agent/60 hover:text-foreground",
          className,
        )}
      >
        <span className="text-agent">▴</span>
        {label}
        {summary !== undefined && summary !== null && (
          <span className="text-muted-foreground tracking-normal normal-case">
            {summary}
          </span>
        )}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        // z-[60]: Base UI mounts the backdrop after the popup, so at the sheet's
        // default z-50 the dimming overlay would sit on top of the tray itself.
        className="border-border bg-background text-foreground z-[60] gap-0 p-0 text-[13px] leading-[1.6]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex h-[min(78svh,44rem)] min-h-0 flex-col p-3 pt-5 sm:p-4 sm:pt-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
