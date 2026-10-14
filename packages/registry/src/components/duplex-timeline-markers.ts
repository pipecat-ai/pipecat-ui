/** A moment on the duplex timeline. Times are performance.now() ms. */
export type DuplexTimelineMarker =
  | { id: number; kind: "turn-end"; at: number }
  | { id: number; kind: "reply"; at: number; from: number }
  | {
      id: number;
      kind: "interruption";
      /** The user's turn was announced. */
      at: number;
      /** The bot stopped, or null while it's still talking. */
      cutAt: number | null;
    }
  | {
      id: number;
      kind: "bot-backchannel";
      at: number;
      end: number | null;
      text: string;
    }
  | { id: number; kind: "user-backchannel"; at: number; text: string };

/** RTVI turn and backchannel events, stamped with performance.now(). */
export type DuplexTimelineEvent =
  | {
      type:
        | "connected"
        | "disconnected"
        | "user-started-speaking"
        | "user-stopped-speaking"
        | "bot-started-speaking"
        | "bot-stopped-speaking";
      now: number;
    }
  | { type: "bot-backchannel" | "user-backchannel"; now: number; text: string };

export interface DuplexTimelineState {
  markers: DuplexTimelineMarker[];
  nextId: number;
  userSpeaking: boolean;
  botSpeaking: boolean;
  /** The bot holds the floor (not backchannelling). */
  botReplying: boolean;
  /** The bot's last reply ended uninterrupted. */
  replyEndedAt: number | null;
  /** The user's last turn ended, pending a reply. */
  userStoppedAt: number | null;
  /** The bot was talked over and is still speaking. */
  interrupted: boolean;
}

export const DUPLEX_TIMELINE_INITIAL_STATE: DuplexTimelineState = {
  markers: [],
  nextId: 0,
  userSpeaking: false,
  botSpeaking: false,
  botReplying: false,
  replyEndedAt: null,
  userStoppedAt: null,
  interrupted: false,
};

/** Markers older than this are off screen. */
const KEEP_MS = 120_000;
/** A "reply" this close to a bot backchannel was the backchannel. */
const BACKCHANNEL_OVERLAP_MS = 1000;
/** An "interruption" this close to a user backchannel was the backchannel. */
const ACKNOWLEDGMENT_MS = 3000;
/**
 * The server holds a turn while classifying it, so the bot may stop before
 * an interrupting turn is announced. The renderer checks the audio.
 */
const LATE_INTERRUPTION_MS = 1500;

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

function withMarker(
  state: DuplexTimelineState,
  markers: DuplexTimelineMarker[],
  marker: WithoutId<DuplexTimelineMarker>,
): Pick<DuplexTimelineState, "markers" | "nextId"> {
  const cutoff = marker.at - KEEP_MS;
  return {
    markers: [
      ...markers.filter((existing) => existing.at >= cutoff),
      { ...marker, id: state.nextId },
    ],
    nextId: state.nextId + 1,
  };
}

/**
 * Turns RTVI turn and backchannel events into timeline markers: handoffs
 * with reply latency, interruptions, and backchannels on either side.
 */
export function reduceDuplexTimeline(
  state: DuplexTimelineState,
  event: DuplexTimelineEvent,
): DuplexTimelineState {
  const { now } = event;
  switch (event.type) {
    case "connected":
      return { ...DUPLEX_TIMELINE_INITIAL_STATE, nextId: state.nextId };

    case "disconnected":
      return {
        ...state,
        userSpeaking: false,
        botSpeaking: false,
        botReplying: false,
        interrupted: false,
      };

    case "user-started-speaking":
      if (state.botReplying) {
        return {
          ...state,
          ...withMarker(state, state.markers, {
            kind: "interruption",
            at: now,
            cutAt: null,
          }),
          interrupted: true,
          userSpeaking: true,
        };
      }
      if (
        state.replyEndedAt !== null &&
        now - state.replyEndedAt < LATE_INTERRUPTION_MS
      ) {
        return {
          ...state,
          ...withMarker(state, state.markers, {
            kind: "interruption",
            at: now,
            cutAt: state.replyEndedAt,
          }),
          replyEndedAt: null,
          userSpeaking: true,
        };
      }
      return { ...state, userSpeaking: true };

    case "user-stopped-speaking":
      return {
        ...state,
        ...withMarker(state, state.markers, { kind: "turn-end", at: now }),
        userSpeaking: false,
        userStoppedAt: now,
      };

    case "bot-started-speaking":
      // Inside the user's turn it's a backchannel playing.
      if (state.userSpeaking) return { ...state, botSpeaking: true };
      return {
        ...state,
        ...(state.userStoppedAt === null
          ? {}
          : withMarker(state, state.markers, {
              kind: "reply",
              at: now,
              from: state.userStoppedAt,
            })),
        botSpeaking: true,
        botReplying: true,
        userStoppedAt: null,
      };

    case "bot-stopped-speaking": {
      const markers = state.markers.map((marker) => {
        if (marker.kind === "bot-backchannel" && marker.end === null) {
          return { ...marker, end: now };
        }
        if (
          state.interrupted &&
          marker.kind === "interruption" &&
          marker.cutAt === null
        ) {
          return { ...marker, cutAt: now };
        }
        return marker;
      });
      return {
        ...state,
        markers,
        botSpeaking: false,
        botReplying: false,
        replyEndedAt: state.botReplying && !state.interrupted ? now : null,
        interrupted: false,
      };
    }

    case "bot-backchannel": {
      // Bot output follows bot-started-speaking, so speech that read as a
      // reply may have been this backchannel: undo it.
      const reply = state.markers.find(
        (marker) =>
          marker.kind === "reply" && now - marker.at < BACKCHANNEL_OVERLAP_MS,
      );
      return {
        ...state,
        ...withMarker(
          state,
          state.markers.filter((marker) => marker !== reply),
          { kind: "bot-backchannel", at: now, end: null, text: event.text },
        ),
        userStoppedAt:
          reply?.kind === "reply" ? reply.from : state.userStoppedAt,
        botReplying: reply ? false : state.botReplying,
      };
    }

    case "user-backchannel":
      // It may have read as an interruption first.
      return {
        ...state,
        ...withMarker(
          state,
          state.markers.filter(
            (marker) =>
              marker.kind !== "interruption" ||
              now - marker.at > ACKNOWLEDGMENT_MS,
          ),
          { kind: "user-backchannel", at: now, text: event.text },
        ),
        interrupted: false,
      };
  }
}
