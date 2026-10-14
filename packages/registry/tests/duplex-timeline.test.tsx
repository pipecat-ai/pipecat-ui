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
  type DuplexTimelineState,
} from "@/components/pipecat/duplex-timeline-markers";

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

  it("treats a turn just after a reply ends as a late interruption", () => {
    const late = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("bot-stopped-speaking", 3000),
      turn("user-started-speaking", 4000),
    );
    expect(late.markers.at(-1)).toMatchObject({
      kind: "interruption",
      cutAt: 3000,
    });

    const fresh = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("bot-stopped-speaking", 3000),
      turn("user-started-speaking", 5000),
    );
    expect(fresh.markers.some((m) => m.kind === "interruption")).toBe(false);
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

  it("drops a recent interruption that turned out to be a user backchannel", () => {
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("bot-started-speaking", 500),
      turn("user-started-speaking", 2000),
      said("user-backchannel", 2600, "Yeah."),
    );
    expect(state.markers.map((m) => m.kind)).toEqual([
      "turn-end",
      "reply",
      "user-backchannel",
    ]);
    expect(state.interrupted).toBe(false);
  });

  it("prunes markers that have scrolled off", () => {
    const state = play(
      turn("user-stopped-speaking", 0),
      turn("user-stopped-speaking", 121_000),
    );
    expect(state.markers).toHaveLength(1);
    expect(state.markers[0]?.at).toBe(121_000);
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

  it("lights a lane label while that side speaks", () => {
    render(<DuplexTimelineView agentSpeaking userLabel="caller" />);
    expect(screen.getByText("agent")).toHaveClass("text-foreground");
    expect(screen.getByText("caller")).not.toHaveClass("text-foreground");
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

describe("useDuplexTimelineMarkers", () => {
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
    expect(screen.getByText("caller")).toHaveClass("text-foreground");
    emit(RTVIEvent.UserStoppedSpeaking);
    emit(RTVIEvent.BotStartedSpeaking);
    expect(screen.getByText("caller")).not.toHaveClass("text-foreground");
    expect(screen.getByText("agent")).toHaveClass("text-foreground");
  });
});
