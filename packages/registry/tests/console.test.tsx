import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Console } from "@/components/pipecat/console/console";
import { StubTransport } from "./helpers/stub-transport";

const transports = vi.hoisted(() => ({
  createTransport: vi.fn(),
}));

vi.mock("@/lib/transports", () => ({
  createTransport: transports.createTransport,
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
  setViewportWidth(1024);
  transports.createTransport.mockImplementation(
    async () => new StubTransport(),
  );
  // The real connect awaits a bot-ready handshake that never comes in jsdom.
  vi.spyOn(PipecatClient.prototype, "connect").mockResolvedValue(
    undefined as never,
  );
  vi.spyOn(PipecatClient.prototype, "disconnect").mockResolvedValue(
    undefined as never,
  );
  vi.spyOn(PipecatClient.prototype, "initDevices").mockResolvedValue(undefined);
});

async function renderConsole(ui: React.ReactElement) {
  const utils = render(ui);
  await waitFor(() =>
    expect(
      document.querySelector("[data-slot=console][data-state=ready]"),
    ).not.toBeNull(),
  );
  return utils;
}

describe("Console", () => {
  it("shows a spinner while the client boots, then the console", async () => {
    render(<Console />);
    expect(document.querySelector("[data-slot=spinner]")).not.toBeNull();
    await waitFor(() =>
      expect(
        document.querySelector("[data-slot=console][data-state=ready]"),
      ).not.toBeNull(),
    );
    expect(document.querySelector("[data-slot=connect-button]")).not.toBeNull();
    expect(screen.getByText("Pipecat Console")).toBeInTheDocument();
  });

  it("surfaces transport load failures instead of spinning forever", async () => {
    transports.createTransport.mockRejectedValueOnce(
      new Error(
        'Failed to load transport "daily". Make sure the package is installed: npm install @pipecat-ai/daily-transport.',
      ),
    );
    render(<Console transportType="daily" />);
    await waitFor(() =>
      expect(
        screen.getByText(/npm install @pipecat-ai\/daily-transport/),
      ).toBeInTheDocument(),
    );
    expect(document.querySelector("[data-slot=spinner]")).toBeNull();
  });

  it("hides bot video by default and renders bot audio", async () => {
    await renderConsole(<Console />);
    expect(
      document.querySelector("[data-slot=console-bot-audio-panel]"),
    ).not.toBeNull();
    expect(
      document.querySelector("[data-slot=console-bot-video-panel]"),
    ).toBeNull();
  });

  it("removes regions per no* props and drops the collapse toggle without an info panel", async () => {
    await renderConsole(
      <Console
        noEvents
        noStatusInfo
        noSessionInfo
        noUserAudio
        noUserVideo
        noScreenControl
      />,
    );
    expect(
      document.querySelector("[data-slot=console-events-panel]"),
    ).toBeNull();
    expect(document.querySelector("[data-slot=console-info-panel]")).toBeNull();
    expect(screen.queryByLabelText(/info panel/i)).toBeNull();
  });

  it("renders the headerSlot when provided", async () => {
    await renderConsole(
      <Console headerSlot={<button type="button">Theme</button>} />,
    );
    expect(screen.getByRole("button", { name: "Theme" })).toBeInTheDocument();
  });

  it("shows the real session error and dismisses it", async () => {
    vi.spyOn(PipecatClient.prototype, "connect").mockRejectedValueOnce(
      new Error("bot exploded") as never,
    );
    const user = userEvent.setup();
    await renderConsole(<Console />);
    await user.click(
      document.querySelector("[data-slot=connect-button]") as HTMLElement,
    );
    await waitFor(() =>
      expect(
        screen.getByText("Failed to start session: bot exploded"),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByLabelText("Dismiss error"));
    expect(
      screen.queryByText("Failed to start session: bot exploded"),
    ).toBeNull();
  });

  it("switches to the tab layout on narrow viewports without doubling panels", async () => {
    setViewportWidth(500);
    await renderConsole(<Console />);
    expect(screen.getAllByRole("tab").length).toBeGreaterThanOrEqual(3);
    // Conversation opens by default and is mounted once; other inactive tabs
    // are unmounted entirely.
    expect(
      document.querySelectorAll("[data-slot=console-conversation-panel]"),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll("[data-slot=console-bot-audio-panel]"),
    ).toHaveLength(0);
    expect(
      document.querySelectorAll("[data-slot=console-events-panel]"),
    ).toHaveLength(0);
  });

  it("builds from transportFactory without a registered loader and applies codecs only for smallwebrtc", async () => {
    const codecTransport = () =>
      Object.assign(new StubTransport(), {
        setAudioCodec: vi.fn(),
        setVideoCodec: vi.fn(),
      });
    const webrtc = codecTransport();
    const factory = vi.fn(() => webrtc);
    const { unmount } = await renderConsole(
      <Console
        transportFactory={factory}
        transportOptions={{ waitForICEGathering: true }}
        audioCodec="opus"
      />,
    );
    expect(factory).toHaveBeenCalledWith({ waitForICEGathering: true });
    expect(transports.createTransport).not.toHaveBeenCalled();
    expect(webrtc.setAudioCodec).toHaveBeenCalledWith("opus");
    expect(webrtc.setVideoCodec).toHaveBeenCalledWith("default");
    unmount();

    const websocket = codecTransport();
    await renderConsole(
      <Console transportType="websocket" transportFactory={() => websocket} />,
    );
    expect(websocket.setAudioCodec).not.toHaveBeenCalled();
  });

  it("keeps collecting metrics while the metrics tab is closed", async () => {
    let client: PipecatClient | undefined;
    const user = userEvent.setup();
    await renderConsole(
      <Console
        onClient={(created) => {
          client = created;
        }}
      />,
    );
    act(() => {
      client!.emit(RTVIEvent.Metrics, {
        ttfb: [{ processor: "CartesiaTTSService#0", value: 0.1 }],
      });
    });
    await user.click(screen.getByRole("tab", { name: "Metrics" }));
    expect(
      await screen.findByText("TTFB · CartesiaTTSService#0"),
    ).toBeInTheDocument();
  });

  it("shows the camera preview tile only while the camera is on", async () => {
    let client: PipecatClient | undefined;
    await renderConsole(
      <Console
        onClient={(created) => {
          client = created;
        }}
      />,
    );
    expect(
      document.querySelector("[data-slot=user-video-control]"),
    ).not.toBeNull();
    expect(document.querySelector("[data-slot=user-video-tile]")).toBeNull();

    vi.spyOn(PipecatClient.prototype, "isCamEnabled", "get").mockReturnValue(
      true,
    );
    act(() => {
      client!.emit(
        RTVIEvent.TrackStarted,
        { kind: "video" } as MediaStreamTrack,
        {
          id: "local",
          name: "local",
          local: true,
        },
      );
    });
    await waitFor(() =>
      expect(
        document.querySelector("[data-slot=user-video-tile]"),
      ).not.toBeNull(),
    );
  });

  it("keeps capturing events while the mobile events tab is closed", async () => {
    setViewportWidth(500);
    let client: PipecatClient | undefined;
    const user = userEvent.setup();
    await renderConsole(
      <Console
        onClient={(created) => {
          client = created;
        }}
      />,
    );
    act(() => {
      client!.emit(RTVIEvent.ServerMessage, { hello: "world" });
    });
    await user.click(screen.getByRole("tab", { name: "Events" }));
    expect(await screen.findByText("serverMessage")).toBeInTheDocument();
  });
});
