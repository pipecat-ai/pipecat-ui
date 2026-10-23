import { RTVIEvent } from "@pipecat-ai/client-js";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DuplexTimeline,
  DuplexTimelineView,
  useDuplexTimelineMarkers,
} from "@/components/pipecat/duplex-timeline";
import {
  DUPLEX_TIMELINE_INITIAL_STATE,
  reduceDuplexTimeline,
  type DuplexTimelineEvent,
  type DuplexTimelineMarker,
  type DuplexTimelineState,
} from "@/components/pipecat/duplex-timeline-markers";
import { DUPLEX_TIMELINE_HISTORY_MS } from "@/components/pipecat/duplex-timeline-renderer";

const hooks = vi.hoisted(() => ({
  usePipecatClientMediaTrack: vi.fn(),
  usePipecatClientTransportState: vi.fn(),
  useRTVIClientEvent: vi.fn(),
}));

vi.mock("@pipecat-ai/client-react", () => ({
  usePipecatClientMediaTrack: hooks.usePipecatClientMediaTrack,
  usePipecatClientTransportState: hooks.usePipecatClientTransportState,
  useRTVIClientEvent: hooks.useRTVIClientEvent,
}));

// The mock re-registers on every render, so the map always holds the
// handler with the freshest closure.
const eventHandlers = new Map<string, (payload?: unknown) => void>();

function emit(event: RTVIEvent, payload?: unknown) {
  act(() => {
    eventHandlers.get(String(event))?.(payload);
  });
}

const fakeTrack = (id: string) =>
  ({ kind: "audio", id }) as unknown as MediaStreamTrack;

beforeEach(() => {
  vi.clearAllMocks();
  eventHandlers.clear();
  hooks.usePipecatClientMediaTrack.mockReturnValue(null);
  hooks.usePipecatClientTransportState.mockReturnValue("ready");
  hooks.useRTVIClientEvent.mockImplementation(
    (event: RTVIEvent, handler: (payload?: unknown) => void) => {
      eventHandlers.set(String(event), handler);
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

type TurnEvent = Exclude<
  DuplexTimelineEvent["type"],
  "bot-backchannel" | "user-backchannel"
>;

const turn = (type: TurnEvent, now: number): DuplexTimelineEvent => ({
  type,
  now,
});
const said = (
  type: "bot-backchannel" | "user-backchannel",
  now: number,
  text: string,
): DuplexTimelineEvent => ({ type, now, text });

const play = (...events: DuplexTimelineEvent[]): DuplexTimelineState =>
  events.reduce(reduceDuplexTimeline, DUPLEX_TIMELINE_INITIAL_STATE);

describe("reduceDuplexTimeline", () => {
  it("marks a handoff with the latency from the user's turn end", () => {
    const state = play(
      turn("user-started-speaking", 0),
      turn("user-stopped-speaking", 1000),
      turn("bot-started-speaking", 1600),
    );
    expect(state.markers.map((m) => m.kind)).toEqual(["turn-end", "reply"]);
    expect(state.markers[1]).toMatchObject({ at: 1600, from: 1000 });
    expect(state.botReplying).toBe(true);
  });

  it("marks an interruption and closes it when the bot stops", () => {
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("user-started-speaking", 2000),
      turn("bot-stopped-speaking", 2300),
    );
    expect(state.markers.at(-1)).toMatchObject({
      kind: "interruption",
      at: 2000,
      cutAt: 2300,
    });
    expect(state.replyEndedAt).toBeNull();
  });

  it("marks a turn just after a reply ends as a possible interruption", () => {
    const late = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("bot-stopped-speaking", 3000),
      turn("user-started-speaking", 4000),
    );
    expect(late.markers.at(-1)).toMatchObject({
      kind: "possible-interruption",
      cutAt: 3000,
    });

    const fresh = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("bot-stopped-speaking", 3000),
      turn("user-started-speaking", 5000),
    );
    expect(fresh.markers.at(-1)?.kind).toBe("reply");
  });

  it("keeps a bot backchannel inside the user's turn off the handoffs", () => {
    const state = play(
      turn("user-started-speaking", 0),
      turn("bot-started-speaking", 800),
      said("bot-backchannel", 810, "Mm-hmm."),
      turn("bot-stopped-speaking", 1200),
    );
    expect(state.markers).toEqual([
      expect.objectContaining({
        kind: "bot-backchannel",
        at: 810,
        end: 1200,
        text: "Mm-hmm.",
      }),
    ]);
    expect(state.botReplying).toBe(false);
  });

  it("undoes a reply that was really a bot backchannel", () => {
    const state = play(
      turn("user-stopped-speaking", 1000),
      turn("bot-started-speaking", 1200),
      said("bot-backchannel", 1250, "Right."),
    );
    expect(state.markers.map((m) => m.kind)).toEqual([
      "turn-end",
      "bot-backchannel",
    ]);
    expect(state.userStoppedAt).toBe(1000);
    expect(state.botReplying).toBe(false);
  });

  it("undoes only the reply opened by the bot's current speech", () => {
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 100),
      turn("bot-stopped-speaking", 400),
      turn("user-started-speaking", 600),
      turn("bot-started-speaking", 800),
      said("bot-backchannel", 810, "Mm-hmm."),
    );
    expect(state.markers).toContainEqual(
      expect.objectContaining({ kind: "reply", at: 100, from: 0 }),
    );
    expect(state.userStoppedAt).toBeNull();
  });

  it("doesn't count talking over a bot backchannel as an interruption", () => {
    const state = play(
      turn("bot-started-speaking", 0),
      said("bot-backchannel", 10, "Right."),
      turn("user-started-speaking", 300),
    );
    expect(state.markers.map((m) => m.kind)).toEqual(["bot-backchannel"]);
  });

  it("records a user backchannel without touching the bot's turn", () => {
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      said("user-backchannel", 1800, "Mm-hmm."),
    );
    expect(state.markers.map((m) => m.kind)).toEqual([
      "turn-end",
      "reply",
      "user-backchannel",
    ]);
    expect(state.botReplying).toBe(true);
  });

  it("keeps an earlier interruption when a user backchannel follows", () => {
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("user-started-speaking", 2000),
      turn("bot-stopped-speaking", 2300),
      turn("user-stopped-speaking", 3000),
      turn("bot-started-speaking", 3500),
      said("user-backchannel", 4500, "ok"),
    );
    expect(state.markers).toContainEqual(
      expect.objectContaining({ kind: "interruption", at: 2000, cutAt: 2300 }),
    );
  });

  it("closes open markers on disconnect", () => {
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("user-started-speaking", 1000),
      turn("disconnected", 1200),
    );
    expect(state.markers.at(-1)).toMatchObject({
      kind: "interruption",
      cutAt: 1200,
    });
  });

  it("keeps the same markers when the bot stops with nothing open", () => {
    const speaking = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
    );
    const stopped = reduceDuplexTimeline(speaking, {
      type: "bot-stopped-speaking",
      now: 900,
    });
    expect(stopped.markers).toBe(speaking.markers);
  });

  it("prunes markers older than the level history", () => {
    const later = DUPLEX_TIMELINE_HISTORY_MS + 1000;
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("user-stopped-speaking", later),
    );
    expect(state.markers).toHaveLength(1);
    expect(state.markers[0]?.at).toBe(later);
  });

  it("starts over on connect but keeps ids unique", () => {
    const before = play(
      turn("user-stopped-speaking", 0),
      turn("connected", 10),
    );
    expect(before.markers).toEqual([]);
    const after = reduceDuplexTimeline(before, {
      type: "user-stopped-speaking",
      now: 20,
    });
    expect(after.markers[0]?.id).toBe(1);
  });
});

describe("DuplexTimelineView", () => {
  const getRoot = (container: HTMLElement) =>
    container.querySelector('[data-slot="duplex-timeline"]');

  it("renders an idle canvas with both lane labels", () => {
    const { container } = render(<DuplexTimelineView />);
    expect(getRoot(container)).toHaveAttribute("data-state", "idle");
    expect(
      screen.getByRole("img", { name: "agent and you speech over time" }),
    ).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
    expect(screen.getByText("you")).toBeInTheDocument();
  });

  it("runs a frame loop only while running", () => {
    const request = vi.spyOn(globalThis, "requestAnimationFrame");
    const cancel = vi.spyOn(globalThis, "cancelAnimationFrame");
    const { container, rerender } = render(<DuplexTimelineView />);
    expect(request).not.toHaveBeenCalled();

    rerender(<DuplexTimelineView running />);
    expect(getRoot(container)).toHaveAttribute("data-state", "live");
    expect(request).toHaveBeenCalledTimes(1);

    rerender(<DuplexTimelineView running={false} />);
    expect(cancel).toHaveBeenCalled();
  });

  it("marks the speaking lane and passes lane label classes through", () => {
    render(
      <DuplexTimelineView
        agentSpeaking
        userLabel="caller"
        laneLabelClassName="lane"
      />,
    );
    expect(screen.getByText("agent")).toHaveAttribute("data-state", "speaking");
    expect(screen.getByText("caller")).toHaveAttribute("data-state", "silent");
    expect(screen.getByText("caller")).toHaveClass("lane");
  });

  it("releases each track's audio context when tracks change or unmount", () => {
    const close = vi.spyOn(AudioContext.prototype, "close");
    const userTrack = fakeTrack("u1");
    const { rerender, unmount } = render(
      <DuplexTimelineView agentTrack={fakeTrack("a1")} userTrack={userTrack} />,
    );
    expect(close).not.toHaveBeenCalled();

    rerender(
      <DuplexTimelineView agentTrack={fakeTrack("a2")} userTrack={userTrack} />,
    );
    expect(close).toHaveBeenCalledTimes(1);

    unmount();
    expect(close).toHaveBeenCalledTimes(3);
  });
});

describe("DuplexTimelineView labels", () => {
  // Frames draw once the canvas has a width, which arrives asynchronously.
  const resizeCallbacks: ResizeObserverCallback[] = [];
  const resize = (width: number) =>
    act(() => {
      // The setup's canvas stub returns undefined; lane masks need a gradient.
      const gradient: CanvasGradient = { addColorStop() {} };
      for (const canvas of document.querySelectorAll("canvas")) {
        const context = canvas.getContext("2d");
        if (context) {
          vi.mocked(context.createLinearGradient).mockReturnValue(gradient);
        }
      }
      const entries = [{ contentRect: { width } }] as ResizeObserverEntry[];
      for (const callback of resizeCallbacks) {
        callback(entries, {} as ResizeObserver);
      }
    });

  beforeEach(() => {
    resizeCallbacks.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const markers = (): DuplexTimelineMarker[] => {
    const now = performance.now();
    return [
      { id: 0, kind: "turn-end", at: now - 4000 },
      { id: 1, kind: "reply", at: now - 2500, from: now - 4000 },
      { id: 2, kind: "user-backchannel", at: now - 2000, text: "Mm-hmm." },
    ];
  };

  it("draws backchannel and latency labels as classed spans", () => {
    render(
      <DuplexTimelineView
        markers={markers()}
        backchannelLabelClassName="backchannel"
      />,
    );
    resize(600);
    expect(screen.getByText("mm-hmm")).toHaveAttribute(
      "data-slot",
      "duplex-timeline-backchannel-label",
    );
    expect(screen.getByText("mm-hmm")).toHaveClass("backchannel");
    expect(screen.getByText("1.5s")).toHaveAttribute("data-slow");
  });

  it("labels elapsed time since it started, every five seconds", () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const { rerender } = render(<DuplexTimelineView running />);
    resize(600);
    now.mockReturnValue(13_000);
    rerender(<DuplexTimelineView running={false} />);
    expect(
      [...document.querySelectorAll('[data-slot="duplex-timeline-time-label"]')]
        .map((label) => label.textContent)
        .sort(),
    ).toEqual(["0:05", "0:10"]);
  });

  it.each([
    ["noBackchannels", "mm-hmm"],
    ["noSegmentLabels", "mm-hmm"],
    ["noLatency", "1.5s"],
    ["noTimeLabels", "0:00"],
    ["noLaneLabels", "agent"],
    ["noLegend", "handoff"],
  ])("%s hides %s", (option, text) => {
    render(<DuplexTimelineView markers={markers()} {...{ [option]: true }} />);
    resize(600);
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  });

  it("removes its labels on unmount", () => {
    const { unmount } = render(<DuplexTimelineView markers={markers()} />);
    resize(600);
    const latency = screen.getByText("1.5s");
    unmount();
    expect(latency.isConnected).toBe(false);
  });
});

describe("useDuplexTimelineMarkers", () => {
  it("keeps its RTVI subscriptions across events", () => {
    const seen = new Map<string, Set<unknown>>();
    hooks.useRTVIClientEvent.mockImplementation(
      (event: RTVIEvent, handler: (payload?: unknown) => void) => {
        eventHandlers.set(String(event), handler);
        seen.set(
          String(event),
          (seen.get(String(event)) ?? new Set()).add(handler),
        );
      },
    );
    renderHook(() => useDuplexTimelineMarkers());
    emit(RTVIEvent.UserStartedSpeaking);
    emit(RTVIEvent.BotStartedSpeaking);
    emit(RTVIEvent.UserInput, { text: "ok", input_type: "backchannel" });
    expect([...seen.values()].map((handlers) => handlers.size)).toEqual(
      Array<number>(seen.size).fill(1),
    );
  });

  it("records a bot backchannel once, from its first bot-output", () => {
    const { result } = renderHook(() => useDuplexTimelineMarkers());
    emit(RTVIEvent.UserStartedSpeaking);
    emit(RTVIEvent.BotStartedSpeaking);
    emit(RTVIEvent.BotOutput, {
      text: " Mm-hmm. ",
      text_type: "backchannel",
      spoken_status: "new",
    });
    emit(RTVIEvent.BotOutput, {
      text: "Mm-hmm.",
      text_type: "backchannel",
      spoken_status: "completed",
    });
    emit(RTVIEvent.BotOutput, { text: "Sure,", text_type: "sentence" });

    expect(result.current.markers).toEqual([
      expect.objectContaining({ kind: "bot-backchannel", text: "Mm-hmm." }),
    ]);
    expect(result.current.agentSpeaking).toBe(true);
    expect(result.current.userSpeaking).toBe(true);
  });

  it("records user backchannels but not other user input", () => {
    const { result } = renderHook(() => useDuplexTimelineMarkers());
    emit(RTVIEvent.UserInput, {
      text: "hello",
      input_type: "transcription",
      final: true,
    });
    emit(RTVIEvent.UserInput, {
      text: "Yeah.",
      input_type: "backchannel",
      final: true,
    });
    expect(result.current.markers).toEqual([
      expect.objectContaining({ kind: "user-backchannel", text: "Yeah." }),
    ]);
  });
});

describe("DuplexTimeline", () => {
  it("reads both tracks and runs while the transport is ready", () => {
    const { container } = render(<DuplexTimeline />);
    expect(hooks.usePipecatClientMediaTrack).toHaveBeenCalledWith(
      "audio",
      "bot",
    );
    expect(hooks.usePipecatClientMediaTrack).toHaveBeenCalledWith(
      "audio",
      "local",
    );
    expect(
      container.querySelector('[data-slot="duplex-timeline"]'),
    ).toHaveAttribute("data-state", "live");
  });

  it("lights the lanes from turn events", () => {
    hooks.usePipecatClientTransportState.mockReturnValue("connecting");
    const { container } = render(<DuplexTimeline userLabel="caller" />);
    expect(
      container.querySelector('[data-slot="duplex-timeline"]'),
    ).toHaveAttribute("data-state", "idle");

    emit(RTVIEvent.UserStartedSpeaking);
    expect(screen.getByText("caller")).toHaveAttribute(
      "data-state",
      "speaking",
    );
    emit(RTVIEvent.UserStoppedSpeaking);
    emit(RTVIEvent.BotStartedSpeaking);
    expect(screen.getByText("caller")).toHaveAttribute("data-state", "silent");
    expect(screen.getByText("agent")).toHaveAttribute("data-state", "speaking");
  });
});
