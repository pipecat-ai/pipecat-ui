import type { BotOutputData } from "@pipecat-ai/client-js";
import { RTVIEvent } from "@pipecat-ai/client-js";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TranscriptOverlay,
  TranscriptOverlayView,
} from "@/components/pipecat/transcript-overlay";

const hooks = vi.hoisted(() => ({
  useConversationContext: vi.fn(),
  usePipecatClientTransportState: vi.fn(),
  useRTVIClientEvent: vi.fn(),
}));

vi.mock("@pipecat-ai/client-react", () => ({
  useConversationContext: hooks.useConversationContext,
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

const spoken = (text: string): BotOutputData => ({ text, spoken: true });

beforeEach(() => {
  vi.clearAllMocks();
  eventHandlers.clear();
  hooks.useConversationContext.mockReturnValue({ botOutputSupported: true });
  hooks.usePipecatClientTransportState.mockReturnValue("ready");
  hooks.useRTVIClientEvent.mockImplementation(
    (event: RTVIEvent, handler: (payload?: unknown) => void) => {
      eventHandlers.set(String(event), handler);
    },
  );
});

describe("TranscriptOverlayView", () => {
  it("renders each word in its own animated span", () => {
    const { container } = render(
      <TranscriptOverlayView words={["hello", "brave", "world"]} />,
    );
    const overlay = container.querySelector('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveTextContent("hello brave world");
    const spans = overlay!.querySelectorAll("span");
    expect(spans).toHaveLength(3);
    expect(spans[0]).toHaveClass("animate-in", "fade-in");
  });

  it("applies the per-word fade-in duration", () => {
    const { container } = render(
      <TranscriptOverlayView words={["hi"]} fadeInDuration={150} />,
    );
    const span = container.querySelector("span");
    expect(span).toHaveStyle({ animationDuration: "150ms" });
  });

  it("fades the whole overlay out when the turn ends", () => {
    const { container } = render(
      <TranscriptOverlayView words={["bye"]} turnEnd fadeOutDuration={500} />,
    );
    const overlay = container.querySelector('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveClass("animate-out", "fade-out");
    expect(overlay).toHaveStyle({ animationDuration: "500ms" });
  });
});

describe("TranscriptOverlay", () => {
  it("renders nothing until bot speech arrives", () => {
    const { container } = render(<TranscriptOverlay />);
    expect(container).toBeEmptyDOMElement();
  });

  it("accumulates spoken chunks when mounted after the bot became ready", () => {
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("Hello"));
    emit(RTVIEvent.BotOutput, spoken("there"));

    const overlay = container.querySelector('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveTextContent("Hello there");
    expect(overlay).not.toHaveClass("animate-out");
  });

  it("ignores unspoken BotOutput", () => {
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, { text: "internal", spoken: false });
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when the bot predates BotOutput support", () => {
    hooks.useConversationContext.mockReturnValue({ botOutputSupported: false });
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("Hello"));
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the transport is not ready", () => {
    hooks.usePipecatClientTransportState.mockReturnValue("connected");
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("Hello"));
    expect(container).toBeEmptyDOMElement();
  });

  it("fades out when the bot stops speaking", () => {
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("Done"));
    emit(RTVIEvent.BotStoppedSpeaking);

    const overlay = container.querySelector('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveClass("animate-out", "fade-out");
  });

  it("starts a fresh caption when speech resumes after a turn end", () => {
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("First"));
    emit(RTVIEvent.BotStoppedSpeaking);
    emit(RTVIEvent.BotOutput, spoken("Second"));

    const overlay = container.querySelector('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveTextContent(/^Second$/);
    expect(overlay).not.toHaveClass("animate-out");
  });

  it("keeps every chunk when a new turn arrives in one batch", () => {
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("First"));
    emit(RTVIEvent.BotStoppedSpeaking);

    act(() => {
      eventHandlers.get(RTVIEvent.BotOutput)?.(spoken("Second"));
      eventHandlers.get(RTVIEvent.BotOutput)?.(spoken("turn"));
    });

    const overlay = container.querySelector('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveTextContent(/^Second turn$/);
    expect(overlay).not.toHaveClass("animate-out");
  });

  it("separates turns when the stop and next speech events are batched", () => {
    const { container } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("First"));

    act(() => {
      eventHandlers.get(RTVIEvent.BotStoppedSpeaking)?.();
      eventHandlers.get(RTVIEvent.BotOutput)?.(spoken("Second"));
    });

    const overlay = container.querySelector('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveTextContent(/^Second$/);
    expect(overlay).not.toHaveClass("animate-out");
  });

  it("does not revive the previous session's caption on reconnect", () => {
    const { container, rerender } = render(<TranscriptOverlay />);
    emit(RTVIEvent.BotOutput, spoken("Previous session"));

    hooks.usePipecatClientTransportState.mockReturnValue("disconnected");
    emit(RTVIEvent.TransportStateChanged, "disconnected");
    rerender(<TranscriptOverlay />);
    expect(container).toBeEmptyDOMElement();

    hooks.usePipecatClientTransportState.mockReturnValue("ready");
    emit(RTVIEvent.TransportStateChanged, "ready");
    rerender(<TranscriptOverlay />);
    expect(container).toBeEmptyDOMElement();

    emit(RTVIEvent.BotOutput, spoken("New session"));
    expect(container).toHaveTextContent(/^New session$/);
  });

  it("renders nothing for the local participant", () => {
    const { container } = render(<TranscriptOverlay participant="local" />);
    emit(RTVIEvent.BotOutput, spoken("Hello"));
    expect(container).toBeEmptyDOMElement();
  });

  it("forwards view props like size to the overlay", () => {
    render(<TranscriptOverlay size="lg" className="custom-overlay" />);
    emit(RTVIEvent.BotOutput, spoken("Hello"));
    const overlay = screen
      .getByText("Hello")
      .closest('[data-slot="transcript-overlay"]');
    expect(overlay).toHaveClass("custom-overlay");
  });
});
