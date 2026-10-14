import type { DuplexTimelineMarker } from "@/components/pipecat/duplex-timeline-markers";
import { createVisualizerAnalyser } from "@/lib/visualizer";

export type DuplexTimelineLane = "agent" | "user";

/** Resolved canvas colors and font; see DuplexTimelineView for meanings. */
export interface DuplexTimelinePalette {
  agent: string;
  user: string;
  backchannel: string;
  overlap: string;
  grid: string;
  text: string;
  font: string;
}

/** Scroll speed and bar geometry; one bar per slot of time. */
const PX_PER_SECOND = 56;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const SLOT_PX = BAR_WIDTH + BAR_GAP;
const SLOT_MS = (SLOT_PX / PX_PER_SECOND) * 1000;
/** Slots kept per lane: more than the widest screen shows. */
const SLOT_CAPACITY = 1024;

/** Vertical layout, CSS px. */
const LABEL_ROW = 13;
const LABEL_ROWS = 2;
const LANE_HEIGHT = 40;
const LANE_GAP = 16;
const AXIS_HEIGHT = 14;
const TOP = LABEL_ROW * LABEL_ROWS + 4;
export const DUPLEX_TIMELINE_LANES: Record<
  DuplexTimelineLane,
  { top: number; height: number }
> = {
  agent: { top: TOP, height: LANE_HEIGHT },
  user: { top: TOP + LANE_HEIGHT + LANE_GAP, height: LANE_HEIGHT },
};
const LANES_BOTTOM = DUPLEX_TIMELINE_LANES.user.top + LANE_HEIGHT;
export const DUPLEX_TIMELINE_HEIGHT = LANES_BOTTOM + AXIS_HEIGHT;

interface Segment {
  start: number;
  end: number;
  kind: "backchannel" | "overlap";
}

/** Minimum level that draws a bar. */
const AUDIBLE_LEVEL = 0.02;
/** Minimum level that counts as speech when locating a burst. */
const SPEECH_LEVEL = 0.18;
/** Search window for an acknowledgment's audio before its message. */
const ACKNOWLEDGMENT_SEARCH_MS = 3000;
/** Search window for the user's onset before a turn is announced. */
const ONSET_SEARCH_MS = 2500;
/** Silent slots allowed inside one burst. */
const BURST_GAP_SLOTS = 3;
/** Redraw interval under prefers-reduced-motion; levels still sample per frame. */
const REDUCED_MOTION_FRAME_MS = 500;

/** A track's level, 0–1. */
class LevelMeter {
  private readonly analyser: AnalyserNode;
  private readonly samples: Float32Array<ArrayBuffer>;
  readonly dispose: () => void;

  constructor(track: MediaStreamTrack) {
    const { analyser, dispose } = createVisualizerAnalyser(track);
    this.analyser = analyser;
    this.samples = new Float32Array(analyser.fftSize);
    this.dispose = dispose;
    // Starts suspended outside a user gesture; the connect click allows resume.
    if (analyser.context instanceof AudioContext) {
      void analyser.context.resume();
    }
  }

  /** RMS mapped from -55 dBFS (0) to -10 dBFS (1). */
  read(): number {
    this.analyser.getFloatTimeDomainData(this.samples);
    let squares = 0;
    for (const sample of this.samples) squares += sample * sample;
    const rms = Math.sqrt(squares / this.samples.length);
    const db = 20 * Math.log10(rms + 1e-8);
    return Math.min(1, Math.max(0, (db + 55) / 45));
  }
}

/** Per-slot peak levels for a lane, in a ring buffer. */
class LevelHistory {
  private readonly slots = new Float32Array(SLOT_CAPACITY);
  private last = -1;

  record(slot: number, level: number) {
    if (this.last < 0 || slot - this.last > SLOT_CAPACITY) {
      this.slots.fill(0);
    } else {
      for (let skipped = this.last + 1; skipped < slot; skipped++) {
        this.slots[skipped % SLOT_CAPACITY] = 0;
      }
    }
    if (slot !== this.last) this.slots[slot % SLOT_CAPACITY] = 0;
    const index = slot % SLOT_CAPACITY;
    this.slots[index] = Math.max(this.slots[index] ?? 0, level);
    this.last = Math.max(this.last, slot);
  }

  level(slot: number): number {
    if (slot > this.last || this.last - slot >= SLOT_CAPACITY) return 0;
    return this.slots[slot % SLOT_CAPACITY] ?? 0;
  }

  clear() {
    this.slots.fill(0);
    this.last = -1;
  }
}

export interface DuplexTimelineRenderer {
  setTrack(lane: DuplexTimelineLane, track: MediaStreamTrack | null): void;
  setMarkers(markers: readonly DuplexTimelineMarker[]): void;
  setPalette(palette: DuplexTimelinePalette): void;
  setSlowReplyMs(ms: number): void;
  /** Scrolls while running; holds the last frame when stopped. */
  setRunning(running: boolean): void;
  /** Clears both lanes' level history. */
  reset(): void;
  dispose(): void;
}

/**
 * Two scrolling waveforms, agent over user, colored by what the audio was
 * (speech, backchannel, overlap), with handoff rules and reply latency.
 * Owns its frame loop; the caller feeds tracks, markers and colors.
 */
export function createDuplexTimelineRenderer(
  canvas: HTMLCanvasElement,
): DuplexTimelineRenderer {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("Canvas 2D is unavailable");
  const ctx = context2d;

  let palette: DuplexTimelinePalette = {
    agent: "black",
    user: "black",
    backchannel: "gray",
    overlap: "black",
    grid: "gray",
    text: "gray",
    font: "monospace",
  };
  let markers: readonly DuplexTimelineMarker[] = [];
  let slowReplyMs = 1000;
  const meters: Record<DuplexTimelineLane, LevelMeter | null> = {
    agent: null,
    user: null,
  };
  const history: Record<DuplexTimelineLane, LevelHistory> = {
    agent: new LevelHistory(),
    user: new LevelHistory(),
  };
  /** Per-lane alpha masks, opaque at the centre line. Color independent. */
  const masks = new Map<DuplexTimelineLane, CanvasGradient>();

  let running = false;
  let frozenAt = performance.now();
  let frame = 0;
  let lastDraw = -Infinity;
  let width = 0;

  const reducedMotion =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  const resize = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const dpr = window.devicePixelRatio || 1;
    width = entry.contentRect.width;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(DUPLEX_TIMELINE_HEIGHT * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    masks.clear();
    redraw();
  });
  resize.observe(canvas);

  /** Repaints a held frame; a running loop picks changes up itself. */
  function redraw() {
    if (!running) draw(frozenAt);
  }

  function tick(now: number) {
    const slot = Math.floor(now / SLOT_MS);
    for (const lane of ["agent", "user"] as const) {
      history[lane].record(slot, meters[lane]?.read() ?? 0);
    }
    if (!reducedMotion?.matches || now - lastDraw >= REDUCED_MOTION_FRAME_MS) {
      draw(now);
      lastDraw = now;
    }
    frame = requestAnimationFrame(tick);
  }

  /** x of a time, with now at the right edge. */
  function xAt(time: number, now: number) {
    return width - ((now - time) / 1000) * PX_PER_SECOND;
  }

  function draw(now: number) {
    ctx.clearRect(0, 0, width, DUPLEX_TIMELINE_HEIGHT);
    if (width === 0) return;
    const visible = markers.filter(
      (marker) => xAt(markerEnd(marker, now), now) > -200,
    );
    const spans = segments(visible, now);

    drawLane("agent", palette.agent, spans.agent, now);
    drawLane("user", palette.user, spans.user, now);
    drawGrid(now);
    for (const marker of visible) drawHandoff(marker, now);
    drawLabels(visible, now);
  }

  function markerEnd(marker: DuplexTimelineMarker, now: number) {
    if (marker.kind === "bot-backchannel") return marker.end ?? now;
    if (marker.kind === "interruption") return marker.cutAt ?? now;
    return marker.at;
  }

  const slotOf = (time: number) => Math.floor(time / SLOT_MS);
  const audible = (lane: DuplexTimelineLane, slot: number) =>
    history[lane].level(slot) > AUDIBLE_LEVEL;

  /**
   * The speech burst at or before `from` (back to `limit`), widened to its
   * quiet edges so a segment covers every bar it drew.
   */
  function burstAt(lane: DuplexTimelineLane, from: number, limit: number) {
    let start: number | null = null;
    let end: number | null = null;
    let quiet = 0;
    for (let slot = slotOf(from); slot >= slotOf(limit); slot--) {
      const speaking = history[lane].level(slot) >= SPEECH_LEVEL;
      if (end === null) {
        if (speaking) end = start = slot;
      } else if (speaking) {
        start = slot;
        quiet = 0;
      } else if (++quiet > BURST_GAP_SLOTS) {
        break;
      }
    }
    if (start === null || end === null) return null;
    return widen(lane, start, end);
  }

  /** Extends a slot range while its edges still draw bars. */
  function widen(
    lane: DuplexTimelineLane,
    start: number,
    end: number,
  ): [number, number] {
    const newest = slotOf(performance.now());
    while (audible(lane, start - 1)) start--;
    while (end < newest && audible(lane, end + 1)) end++;
    return [start * SLOT_MS, (end + 1) * SLOT_MS];
  }

  /** A user acknowledgment: the last burst before its message. */
  function acknowledgmentSpan(
    marker: DuplexTimelineMarker & { kind: "user-backchannel" },
  ): [number, number] {
    return (
      burstAt("user", marker.at, marker.at - ACKNOWLEDGMENT_SEARCH_MS) ?? [
        marker.at - 600,
        marker.at,
      ]
    );
  }

  /** A bot backchannel: the agent audio after its message. */
  function botBackchannelSpan(
    marker: DuplexTimelineMarker & { kind: "bot-backchannel" },
    now: number,
  ): [number, number] {
    const end = marker.end ?? now;
    for (let slot = slotOf(marker.at); slot <= slotOf(end + 400); slot++) {
      if (audible("agent", slot)) {
        const [start] = widen("agent", slot, slot);
        const [, last] = widen("agent", slotOf(end), slotOf(end));
        return [start, Math.max(last, end)];
      }
    }
    return [marker.at, end];
  }

  /**
   * An interruption's overlap: from the user's onset (before the turn was
   * announced) to the bot's cut-off. Null if the audio didn't overlap.
   */
  function overlapSpans(
    marker: DuplexTimelineMarker & { kind: "interruption" },
    now: number,
  ): Record<DuplexTimelineLane, [number, number]> | null {
    const cutAt = marker.cutAt ?? now;
    const burst = burstAt("user", marker.at, marker.at - ONSET_SEARCH_MS);
    if (!burst || burst[0] >= cutAt) return null;
    const [, agentEnd] = widen("agent", slotOf(cutAt), slotOf(cutAt));
    return {
      user: [burst[0], cutAt],
      agent: [burst[0], audible("agent", slotOf(cutAt)) ? agentEnd : cutAt],
    };
  }

  /** Non-speech stretches per lane: backchannels and overlaps. */
  function segments(
    visible: readonly DuplexTimelineMarker[],
    now: number,
  ): Record<DuplexTimelineLane, Segment[]> {
    const spans: Record<DuplexTimelineLane, Segment[]> = {
      agent: [],
      user: [],
    };
    for (const marker of visible) {
      if (marker.kind === "bot-backchannel") {
        const [start, end] = botBackchannelSpan(marker, now);
        spans.agent.push({ start, end, kind: "backchannel" });
      } else if (marker.kind === "user-backchannel") {
        const [start, end] = acknowledgmentSpan(marker);
        spans.user.push({ start, end, kind: "backchannel" });
      } else if (marker.kind === "interruption") {
        const overlap = overlapSpans(marker, now);
        if (!overlap) continue;
        for (const lane of ["agent", "user"] as const) {
          const [start, end] = overlap[lane];
          spans[lane].push({ start, end, kind: "overlap" });
        }
      }
    }
    return spans;
  }

  /** Second ticks, a label every five, and the now edge. */
  function drawGrid(now: number) {
    ctx.fillStyle = palette.grid;
    ctx.font = `10px ${palette.font}`;
    ctx.textBaseline = "bottom";
    const firstSecond = Math.ceil(
      (now - (width / PX_PER_SECOND) * 1000) / 1000,
    );
    for (let second = firstSecond; second * 1000 <= now; second++) {
      const x = Math.round(xAt(second * 1000, now));
      const ago = Math.round(now / 1000 - second);
      ctx.fillRect(x, LANES_BOTTOM + 3, 1, ago % 5 === 0 ? 4 : 2);
      if (ago % 5 === 0 && ago > 0) {
        ctx.fillStyle = palette.text;
        ctx.globalAlpha = 0.5;
        ctx.fillText(`-${String(ago)}s`, x + 3, DUPLEX_TIMELINE_HEIGHT);
        ctx.globalAlpha = 1;
        ctx.fillStyle = palette.grid;
      }
    }
    ctx.fillRect(width - 1, TOP - 2, 1, LANES_BOTTOM - TOP + 4);
  }

  /** Fades a lane's bars toward their tips. */
  function laneMask(lane: DuplexTimelineLane) {
    let mask = masks.get(lane);
    if (!mask) {
      const { top, height } = DUPLEX_TIMELINE_LANES[lane];
      mask = ctx.createLinearGradient(0, top, 0, top + height);
      mask.addColorStop(0, "rgba(0, 0, 0, 0.5)");
      mask.addColorStop(0.5, "rgba(0, 0, 0, 1)");
      mask.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      masks.set(lane, mask);
    }
    return mask;
  }

  /** Mirrored bars: lane color for speech, then backchannel or overlap. */
  function drawLane(
    lane: DuplexTimelineLane,
    color: string,
    spans: readonly Segment[],
    now: number,
  ) {
    const box = DUPLEX_TIMELINE_LANES[lane];
    const centre = Math.round(box.top + box.height / 2);
    ctx.fillStyle = palette.grid;
    ctx.fillRect(0, centre, width, 1);

    const colors: Record<Segment["kind"] | "speech", string> = {
      speech: color,
      backchannel: palette.backchannel,
      overlap: palette.overlap,
    };
    const newest = Math.floor(now / SLOT_MS);
    const count = Math.ceil(width / SLOT_PX) + 1;
    for (let slot = newest; slot > newest - count; slot--) {
      const level = history[lane].level(slot);
      if (level <= AUDIBLE_LEVEL) continue;
      const middle = (slot + 0.5) * SLOT_MS;
      const segment = spans.find(
        (span) => middle >= span.start && middle <= span.end,
      );
      ctx.fillStyle = colors[segment?.kind ?? "speech"];
      const x = Math.round(xAt((slot + 1) * SLOT_MS, now)) - BAR_WIDTH;
      const half = Math.max(1, Math.round(level * (box.height / 2 - 1)));
      ctx.fillRect(x, centre - half, BAR_WIDTH, half * 2 + 1);
    }

    // Masking keeps any token color (oklch included) without parsing it.
    // destination-in clears everything outside its shape, so clip to the lane.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, box.top, width, box.height);
    ctx.clip();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = laneMask(lane);
    ctx.fillRect(0, box.top, width, box.height);
    ctx.restore();
  }

  function dashedRule(x: number) {
    ctx.strokeStyle = palette.text;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, TOP - 2);
    ctx.lineTo(Math.round(x) + 0.5, LANES_BOTTOM + 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /** Handoff rules, with the reply latency between them. */
  function drawHandoff(marker: DuplexTimelineMarker, now: number) {
    if (marker.kind === "turn-end") dashedRule(xAt(marker.at, now));
    if (marker.kind === "reply") {
      const x = xAt(marker.at, now);
      dashedRule(x);
      drawLatency(xAt(marker.from, now), x, marker.at - marker.from);
    }
  }

  /** A bracket between the lanes, labelled with the gap. */
  function drawLatency(from: number, to: number, ms: number) {
    const y =
      Math.round(DUPLEX_TIMELINE_LANES.agent.top + LANE_HEIGHT + LANE_GAP / 2) +
      0.5;
    const color = ms >= slowReplyMs ? palette.overlap : palette.text;
    const text =
      ms < 1000 ? `${String(Math.round(ms))}ms` : `${(ms / 1000).toFixed(1)}s`;
    ctx.font = `10px ${palette.font}`;
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(text).width;
    // Too narrow for the text: print it after the reply rule.
    const inside = to - from > textWidth + 8;
    const x = inside ? (from + to) / 2 - textWidth / 2 : to + 4;

    // The line breaks around the text, so no background fill is needed.
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.round(from) + 0.5, y);
    ctx.lineTo(Math.round(inside ? x - 3 : to) + 0.5, y);
    if (inside) {
      ctx.moveTo(Math.round(x + textWidth + 3) + 0.5, y);
      ctx.lineTo(Math.round(to) + 0.5, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /** Short labels; the colors carry the rest. */
  function labelFor(
    marker: DuplexTimelineMarker,
  ): { text: string; color: string } | null {
    switch (marker.kind) {
      case "interruption":
        return { text: "interruption", color: palette.overlap };
      case "bot-backchannel":
      case "user-backchannel":
        return {
          // "Mm-hmm." → "mm-hmm"
          text: marker.text.replace(/[.!?,]+$/, "").toLowerCase(),
          color: palette.backchannel,
        };
      default:
        return null;
    }
  }

  /** A label's x: its segment's start, or null to skip. */
  function labelStart(
    marker: DuplexTimelineMarker,
    now: number,
  ): number | null {
    switch (marker.kind) {
      case "user-backchannel":
        return acknowledgmentSpan(marker)[0];
      case "bot-backchannel":
        return botBackchannelSpan(marker, now)[0];
      case "interruption":
        return overlapSpans(marker, now)?.user[0] ?? null;
      default:
        return null;
    }
  }

  /** Labels above the lanes; a colliding label drops to the second row. */
  function drawLabels(visible: readonly DuplexTimelineMarker[], now: number) {
    ctx.font = `10px ${palette.font}`;
    ctx.textBaseline = "top";
    const rowEnds = Array<number>(LABEL_ROWS).fill(-Infinity);
    const placed = visible
      .flatMap((marker) => {
        const label = labelFor(marker);
        const start = labelStart(marker, now);
        return label && start !== null ? [{ label, start }] : [];
      })
      .sort((a, b) => a.start - b.start);
    for (const { label, start } of placed) {
      const x = Math.round(xAt(start, now));
      const textWidth = ctx.measureText(label.text).width;
      const row = rowEnds.findIndex((end) => x > end + 8);
      if (row < 0) continue;
      rowEnds[row] = x + textWidth;
      ctx.fillStyle = label.color;
      ctx.fillText(label.text, x, row * LABEL_ROW + 2);
    }
  }

  return {
    setTrack(lane, track) {
      meters[lane]?.dispose();
      meters[lane] = track ? new LevelMeter(track) : null;
    },
    setMarkers(next) {
      markers = next;
      redraw();
    },
    setPalette(next) {
      palette = next;
      redraw();
    },
    setSlowReplyMs(ms) {
      slowReplyMs = ms;
      redraw();
    },
    setRunning(next) {
      if (next === running) return;
      running = next;
      if (running) {
        lastDraw = -Infinity;
        frame = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(frame);
        frozenAt = performance.now();
        draw(frozenAt);
      }
    },
    reset() {
      history.agent.clear();
      history.user.clear();
      frozenAt = performance.now();
      redraw();
    },
    dispose() {
      cancelAnimationFrame(frame);
      resize.disconnect();
      meters.agent?.dispose();
      meters.user?.dispose();
      meters.agent = null;
      meters.user = null;
    },
  };
}
