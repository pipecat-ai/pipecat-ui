"use client";

import type { BotOutputData } from "@pipecat-ai/client-js";
import { RTVIEvent } from "@pipecat-ai/client-js";
import {
  useConversationContext,
  usePipecatClientTransportState,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { cva, type VariantProps } from "class-variance-authority";
import { useState } from "react";

import { cn } from "@/lib/utils";

const transcriptOverlayVariants = cva(
  "mx-auto items-center justify-end text-center *:bg-foreground *:text-background *:mx-auto *:inline *:box-decoration-clone *:text-balance",
  {
    variants: {
      size: {
        sm: "*:rounded-md *:px-2 *:py-1 *:text-xs *:leading-4 *:font-medium",
        default:
          "*:rounded-lg *:px-3 *:py-1.5 *:text-sm *:leading-6 *:font-medium",
        lg: "*:rounded-xl *:px-4 *:py-2 *:text-base *:leading-7 *:font-medium",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export interface TranscriptOverlayViewProps extends VariantProps<
  typeof transcriptOverlayVariants
> {
  /** Words to display as individually animated spans. */
  words: string[];
  /** Whether the speech turn has ended (triggers fade-out). */
  turnEnd?: boolean;
  /** Fade-in duration per word, ms. */
  fadeInDuration?: number;
  /** Fade-out duration for the whole overlay, ms. */
  fadeOutDuration?: number;
  className?: string;
}

/**
 * Caption-style overlay rendering words with per-word fade-in and a
 * fade-out when the turn ends. Line-wrapped background blocks.
 */
export function TranscriptOverlayView({
  words,
  turnEnd = false,
  size,
  fadeInDuration = 300,
  fadeOutDuration = 1000,
  className,
}: TranscriptOverlayViewProps) {
  const containerStyle = {
    "--fade-in-duration": `${fadeInDuration}ms`,
    ...(turnEnd && { animationDuration: `${fadeOutDuration}ms` }),
  } as React.CSSProperties;

  return (
    <div
      data-slot="transcript-overlay"
      className={cn(
        transcriptOverlayVariants({ size }),
        turnEnd && "animate-out fade-out fill-mode-forwards",
        className,
      )}
      style={containerStyle}
    >
      <p>
        {words.map((word, index) => (
          <span
            key={index}
            className="animate-in fade-in"
            style={{ animationDuration: `${fadeInDuration}ms` }}
          >
            {word + (index < words.length - 1 ? " " : "")}
          </span>
        ))}
      </p>
    </div>
  );
}

export interface TranscriptOverlayProps extends Omit<
  TranscriptOverlayViewProps,
  "words" | "turnEnd"
> {
  /** "remote" shows bot speech; "local" is reserved for future use. */
  participant?: "local" | "remote";
}

/**
 * Live caption overlay for bot speech, driven by BotOutput events
 * (requires RTVI 1.1.0+). Renders nothing until the client is ready and
 * speech arrives. Must be rendered inside a PipecatClientProvider.
 */
export function TranscriptOverlay({
  participant = "remote",
  ...props
}: TranscriptOverlayProps) {
  const [caption, setCaption] = useState({
    words: [] as string[],
    turnEnd: false,
  });
  const { botOutputSupported } = useConversationContext();
  const transportState = usePipecatClientTransportState();

  useRTVIClientEvent(RTVIEvent.TransportStateChanged, (state) => {
    if (state !== "ready") setCaption({ words: [], turnEnd: false });
  });

  useRTVIClientEvent(RTVIEvent.BotOutput, (data: BotOutputData) => {
    if (
      participant === "local" ||
      !botOutputSupported ||
      transportState !== "ready"
    ) {
      return;
    }
    if (data.spoken === true && data.text) {
      setCaption((prev) => ({
        words: [...(prev.turnEnd ? [] : prev.words), data.text],
        turnEnd: false,
      }));
    }
  });

  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, () => {
    if (participant === "local") return;
    setCaption((prev) => ({ ...prev, turnEnd: true }));
  });

  if (
    participant === "local" ||
    !botOutputSupported ||
    caption.words.length === 0 ||
    transportState !== "ready"
  ) {
    return null;
  }

  return <TranscriptOverlayView {...caption} {...props} />;
}
