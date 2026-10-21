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

/**
 * Label defaults. Segment colors come through the root's custom properties
 * so a label class name can override them.
 */
const LABEL_CLASSES = {
  backchannel:
    "text-[10px] leading-none text-(color:--duplex-timeline-backchannel)",
  interruption:
    "text-[10px] leading-none text-(color:--duplex-timeline-overlap)",
  latency:
    "text-[10px] leading-none data-slow:text-(color:--duplex-timeline-overlap)",
  time: "text-[10px] leading-none opacity-50",
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
  /** Scrolls while true and holds the last frame when false. Starting clears both lanes and restarts the time axis. */
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
  /** Draw backchannels as speech, without labels. Markers still keep them off the handoffs. */
  noBackchannels?: boolean;
  /** Draw interruption overlaps as speech, without labels. */
  noInterruptions?: boolean;
  /** Hide the dashed rules at turn ends and replies. */
  noHandoffs?: boolean;
  /** Hide reply latency brackets. */
  noLatency?: boolean;
  /** Hide the lane labels; the canvas takes their width. */
  noLaneLabels?: boolean;
  /** Hide backchannel and interruption labels; their bars keep their colors. */
  noSegmentLabels?: boolean;
  /** Hide the elapsed-time labels under the lanes. */
  noTimeLabels?: boolean;
  /** Hide the color key above the lanes; DuplexTimelineLegend can place it elsewhere. */
  noLegend?: boolean;
  className?: string;
  /** Classes for the color key. */
  legendClassName?: string;
  /** Classes for each lane label, which carries data-lane and data-state="speaking" | "silent". */
  laneLabelClassName?: string;
  /** Classes for backchannel labels. */
  backchannelLabelClassName?: string;
  /** Classes for interruption labels. */
  interruptionLabelClassName?: string;
  /** Classes for latency labels; slow replies carry data-slow. */
  latencyLabelClassName?: string;
  /** Classes for the elapsed-time labels. */
  timeLabelClassName?: string;
}

/**
 * Scrolling agent and user waveforms. Handoff rules, latency and time labels
 * use the element's text color. Labels over the canvas are DOM spans.
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
  noBackchannels = false,
  noInterruptions = false,
  noHandoffs = false,
  noLatency = false,
  noLaneLabels = false,
  noSegmentLabels = false,
  noTimeLabels = false,
  noLegend = false,
  className,
  legendClassName,
  laneLabelClassName,
  backchannelLabelClassName,
  interruptionLabelClassName,
  latencyLabelClassName,
  timeLabelClassName,
}: DuplexTimelineViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DuplexTimelineRenderer | null>(null);

  // The renderer owns the frame loop, audio and label spans; props are
  // pushed into it.
  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) return;
    const renderer = createDuplexTimelineRenderer(canvas, labels);
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

  // Before markers, so the first frame creates label spans with their classes.
  useEffect(() => {
    rendererRef.current?.setOptions({
      slowReplyMs,
      backchannels: !noBackchannels,
      interruptions: !noInterruptions,
      handoffs: !noHandoffs,
      latency: !noLatency,
      segmentLabels: !noSegmentLabels,
      timeLabels: !noTimeLabels,
      labelClassNames: {
        backchannel: cn(LABEL_CLASSES.backchannel, backchannelLabelClassName),
        interruption: cn(
          LABEL_CLASSES.interruption,
          interruptionLabelClassName,
        ),
        latency: cn(LABEL_CLASSES.latency, latencyLabelClassName),
        time: cn(LABEL_CLASSES.time, timeLabelClassName),
      },
    });
  }, [
    slowReplyMs,
    noBackchannels,
    noInterruptions,
    noHandoffs,
    noLatency,
    noSegmentLabels,
    noTimeLabels,
    backchannelLabelClassName,
    interruptionLabelClassName,
    latencyLabelClassName,
    timeLabelClassName,
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
        "text-muted-foreground flex flex-col gap-4 font-mono text-[11px]",
        className,
      )}
      style={
        {
          "--duplex-timeline-backchannel": cssColor(backchannelColor),
          "--duplex-timeline-overlap": cssColor(overlapColor),
        } as React.CSSProperties
      }
    >
      {!noLegend && (
        <DuplexTimelineLegend
          backchannelColor={backchannelColor}
          overlapColor={overlapColor}
          noBackchannels={noBackchannels}
          noInterruptions={noInterruptions}
          noHandoffs={noHandoffs}
          className={legendClassName}
        />
      )}
      <div className="flex gap-3">
        {!noLaneLabels && (
          <div
            className="flex shrink-0 flex-col"
            style={{
              paddingTop: agent.top,
              rowGap: user.top - agent.top - agent.height,
            }}
          >
            <LaneLabel
              lane="agent"
              label={agentLabel}
              color={agentColor}
              speaking={agentSpeaking}
              height={agent.height}
              className={laneLabelClassName}
            />
            <LaneLabel
              lane="user"
              label={userLabel}
              color={userColor}
              speaking={userSpeaking}
              height={user.height}
              className={laneLabelClassName}
            />
          </div>
        )}
        <div className="relative min-w-0 flex-1 [mask-image:linear-gradient(to_right,transparent,black_3rem)]">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${agentLabel} and ${userLabel} speech over time`}
            className="block w-full"
            style={{ height: DUPLEX_TIMELINE_HEIGHT }}
          />
          <div
            ref={labelsRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
});

/** Lane name, lit while that side speaks. */
function LaneLabel({
  lane,
  label,
  color,
  speaking,
  height,
  className,
}: {
  lane: "agent" | "user";
  label: string;
  color: string;
  speaking: boolean;
  height: number;
  className?: string;
}) {
  return (
    <span
      data-slot="duplex-timeline-lane-label"
      data-lane={lane}
      data-state={speaking ? "speaking" : "silent"}
      className={cn(
        "group/lane data-[state=speaking]:text-foreground flex items-center gap-1.5",
        className,
      )}
      style={{ height }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full opacity-35 transition-opacity duration-150 group-data-[state=speaking]/lane:opacity-100 motion-reduce:transition-none"
        style={{ backgroundColor: cssColor(color) }}
      />
      {label}
    </span>
  );
}

export interface DuplexTimelineLegendProps {
  /** Match the timeline's backchannelColor. */
  backchannelColor?: string;
  /** Match the timeline's overlapColor. */
  overlapColor?: string;
  /** Match the timeline's noBackchannels, noInterruptions and noHandoffs. */
  noBackchannels?: boolean;
  noInterruptions?: boolean;
  noHandoffs?: boolean;
  className?: string;
}

/** Key for the colors and rules the lane labels don't explain. */
export function DuplexTimelineLegend({
  backchannelColor = DEFAULT_COLORS.backchannel,
  overlapColor = DEFAULT_COLORS.overlap,
  noBackchannels = false,
  noInterruptions = false,
  noHandoffs = false,
  className,
}: DuplexTimelineLegendProps) {
  const swatches = [
    { label: "backchannel", color: backchannelColor, hidden: noBackchannels },
    { label: "overlap", color: overlapColor, hidden: noInterruptions },
  ].filter((swatch) => !swatch.hidden);
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
      {!noHandoffs && (
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-px border-l border-dashed border-current"
          />
          handoff
        </span>
      )}
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
