"use client";

import {
  RTVIEvent,
  type BotOutputData,
  type UserInputData,
} from "@pipecat-ai/client-js";
import {
  usePipecatClientMediaTrack,
  usePipecatClientTransportState,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { memo, useEffect, useReducer, useRef } from "react";

import {
  DUPLEX_TIMELINE_INITIAL_STATE,
  reduceDuplexTimeline,
  type DuplexTimelineMarker,
} from "@/components/pipecat/duplex-timeline-markers";
import {
  createDuplexTimelineRenderer,
  DUPLEX_TIMELINE_HEIGHT,
  DUPLEX_TIMELINE_LANES,
  type DuplexTimelineRenderer,
} from "@/components/pipecat/duplex-timeline-renderer";
import { cn } from "@/lib/utils";
import { resolveVisualizerColor } from "@/lib/visualizer";

export type { DuplexTimelineMarker };

const DEFAULT_COLORS = {
  agent: "--agent-foreground",
  user: "--client-foreground",
  backchannel: "--muted-foreground",
  overlap: "--inactive-background",
  grid: "--border",
};

/** A color prop as CSS: "--token" names become var(--token). */
function cssColor(color: string): string {
  return color.startsWith("--") ? `var(${color})` : color;
}

export interface DuplexTimelineViewProps {
  /** The bot's audio track; the agent lane stays flat when null. */
  agentTrack?: MediaStreamTrack | null;
  /** The user's audio track; the user lane stays flat when null. */
  userTrack?: MediaStreamTrack | null;
  /** Turn markers in performance.now() time, e.g. from useDuplexTimelineMarkers. */
  markers?: readonly DuplexTimelineMarker[];
  /** Scrolls while true and holds the last frame when false. Starting clears both lanes. */
  running?: boolean;
  /** Lights the agent lane label. */
  agentSpeaking?: boolean;
  /** Lights the user lane label. */
  userSpeaking?: boolean;
  agentLabel?: string;
  userLabel?: string;
  /** Agent speech bars. Supports "--css-var" names, "currentColor" and any CSS color. */
  agentColor?: string;
  /** User speech bars; same formats as agentColor. */
  userColor?: string;
  /** Backchannel bars and labels. */
  backchannelColor?: string;
  /** Interruption overlap bars and labels, and slow reply latency. */
  overlapColor?: string;
  /** Centre lines, second ticks and the now edge. */
  gridColor?: string;
  /** Replies at least this slow, in ms, draw their latency in overlapColor. */
  slowReplyMs?: number;
  className?: string;
}

/**
 * Scrolling agent and user waveforms. Handoff rules, reply latency and
 * time labels use the element's text color.
 */
export const DuplexTimelineView = memo(function DuplexTimelineView({
  agentTrack = null,
  userTrack = null,
  markers,
  running = false,
  agentSpeaking = false,
  userSpeaking = false,
  agentLabel = "agent",
  userLabel = "you",
  agentColor = DEFAULT_COLORS.agent,
  userColor = DEFAULT_COLORS.user,
  backchannelColor = DEFAULT_COLORS.backchannel,
  overlapColor = DEFAULT_COLORS.overlap,
  gridColor = DEFAULT_COLORS.grid,
  slowReplyMs = 1000,
  className,
}: DuplexTimelineViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DuplexTimelineRenderer | null>(null);

  // The renderer owns the frame loop and audio; props are pushed into it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createDuplexTimelineRenderer(canvas);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Resolve colors now and whenever the document's theme changes. className
  // is a dependency because it can change what currentColor resolves to.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      rendererRef.current?.setPalette({
        agent: resolveVisualizerColor(agentColor, canvas),
        user: resolveVisualizerColor(userColor, canvas),
        backchannel: resolveVisualizerColor(backchannelColor, canvas),
        overlap: resolveVisualizerColor(overlapColor, canvas),
        grid: resolveVisualizerColor(gridColor, canvas),
        text: resolveVisualizerColor("currentColor", canvas),
        font: getComputedStyle(canvas).fontFamily,
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => observer.disconnect();
  }, [
    agentColor,
    userColor,
    backchannelColor,
    overlapColor,
    gridColor,
    className,
  ]);

  useEffect(() => {
    rendererRef.current?.setTrack("agent", agentTrack);
  }, [agentTrack]);

  useEffect(() => {
    rendererRef.current?.setTrack("user", userTrack);
  }, [userTrack]);

  useEffect(() => {
    rendererRef.current?.setMarkers(markers ?? []);
  }, [markers]);

  useEffect(() => {
    rendererRef.current?.setSlowReplyMs(slowReplyMs);
  }, [slowReplyMs]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (running) renderer.reset();
    renderer.setRunning(running);
  }, [running]);

  const { agent, user } = DUPLEX_TIMELINE_LANES;

  return (
    <div
      data-slot="duplex-timeline"
      data-state={running ? "live" : "idle"}
      className={cn(
        "text-muted-foreground flex gap-3 font-mono text-[11px]",
        className,
      )}
    >
      <div
        className="flex shrink-0 flex-col"
        style={{
          paddingTop: agent.top,
          rowGap: user.top - agent.top - agent.height,
        }}
      >
        <LaneLabel
          label={agentLabel}
          color={agentColor}
          speaking={agentSpeaking}
          height={agent.height}
        />
        <LaneLabel
          label={userLabel}
          color={userColor}
          speaking={userSpeaking}
          height={user.height}
        />
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${agentLabel} and ${userLabel} speech over time`}
        className="block min-w-0 flex-1 [mask-image:linear-gradient(to_right,transparent,black_3rem)]"
        style={{ height: DUPLEX_TIMELINE_HEIGHT }}
      />
    </div>
  );
});

/** Lane name, lit while that side speaks. */
function LaneLabel({
  label,
  color,
  speaking,
  height,
}: {
  label: string;
  color: string;
  speaking: boolean;
  height: number;
}) {
  return (
    <span className="flex items-center gap-1.5" style={{ height }}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full transition-opacity duration-150 motion-reduce:transition-none",
          speaking ? "opacity-100" : "opacity-35",
        )}
        style={{ backgroundColor: cssColor(color) }}
      />
      <span className={cn(speaking && "text-foreground")}>{label}</span>
    </span>
  );
}

export interface DuplexTimelineLegendProps {
  /** Match the timeline's backchannelColor. */
  backchannelColor?: string;
  /** Match the timeline's overlapColor. */
  overlapColor?: string;
  className?: string;
}

/** Key for the colors and rules the lane labels don't explain. */
export function DuplexTimelineLegend({
  backchannelColor = DEFAULT_COLORS.backchannel,
  overlapColor = DEFAULT_COLORS.overlap,
  className,
}: DuplexTimelineLegendProps) {
  const swatches = [
    { label: "backchannel", color: backchannelColor },
    { label: "overlap", color: overlapColor },
  ];
  return (
    <span
      data-slot="duplex-timeline-legend"
      className={cn(
        "text-muted-foreground flex items-center gap-3 font-mono text-[11px]",
        className,
      )}
    >
      {swatches.map(({ label, color }) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-1"
            style={{ backgroundColor: cssColor(color) }}
          />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-px border-l border-dashed border-current"
        />
        handoff
      </span>
    </span>
  );
}

/**
 * Turn markers and speaking state from RTVI turn and backchannel events.
 * Requires PipecatClientProvider and an RTVI 2.2 bot for backchannels.
 */
export function useDuplexTimelineMarkers() {
  const [state, dispatch] = useReducer(
    reduceDuplexTimeline,
    DUPLEX_TIMELINE_INITIAL_STATE,
  );
  const now = () => performance.now();

  useRTVIClientEvent(RTVIEvent.Connected, () =>
    dispatch({ type: "connected", now: now() }),
  );
  useRTVIClientEvent(RTVIEvent.Disconnected, () =>
    dispatch({ type: "disconnected", now: now() }),
  );
  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, () =>
    dispatch({ type: "user-started-speaking", now: now() }),
  );
  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, () =>
    dispatch({ type: "user-stopped-speaking", now: now() }),
  );
  useRTVIClientEvent(RTVIEvent.BotStartedSpeaking, () =>
    dispatch({ type: "bot-started-speaking", now: now() }),
  );
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, () =>
    dispatch({ type: "bot-stopped-speaking", now: now() }),
  );
  useRTVIClientEvent(RTVIEvent.BotOutput, (data: BotOutputData) => {
    // Only a backchannel's first event carries its text; the rest report
    // how much has been spoken.
    if (data.text_type !== "backchannel") return;
    if (data.spoken_status && data.spoken_status !== "new") return;
    dispatch({ type: "bot-backchannel", text: data.text.trim(), now: now() });
  });
  useRTVIClientEvent(RTVIEvent.UserInput, (data: UserInputData) => {
    if (data.input_type !== "backchannel") return;
    dispatch({ type: "user-backchannel", text: data.text.trim(), now: now() });
  });

  return {
    markers: state.markers,
    agentSpeaking: state.botSpeaking,
    userSpeaking: state.userSpeaking,
  };
}

export type DuplexTimelineProps = Omit<
  DuplexTimelineViewProps,
  | "agentTrack"
  | "userTrack"
  | "markers"
  | "running"
  | "agentSpeaking"
  | "userSpeaking"
>;

/** Requires PipecatClientProvider; scrolls while the transport is ready. */
export function DuplexTimeline(props: DuplexTimelineProps) {
  const agentTrack = usePipecatClientMediaTrack("audio", "bot");
  const userTrack = usePipecatClientMediaTrack("audio", "local");
  const running = usePipecatClientTransportState() === "ready";
  const { markers, agentSpeaking, userSpeaking } = useDuplexTimelineMarkers();

  return (
    <DuplexTimelineView
      {...props}
      agentTrack={agentTrack}
      userTrack={userTrack}
      markers={markers}
      running={running}
      agentSpeaking={agentSpeaking}
      userSpeaking={userSpeaking}
    />
  );
}
