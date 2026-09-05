import { useState } from "react";
import {
  PipecatClientProvider,
  usePipecatClientTransportState,
} from "@pipecat-ai/client-react";
import { Panel } from "@/components/demo/panel";
import { Tray } from "@/components/demo/tray";
import { AudioVisualizerWave } from "@/components/pipecat/audio-visualizer-wave";
import { AudioVisualizerBar } from "@/components/pipecat/audio-visualizer-bar";
import { BotAudioOutput } from "@/components/pipecat/bot-audio";
import { ConnectButton } from "@/components/pipecat/connect-button";
import { Conversation } from "@/components/pipecat/conversation";
import { TextInput } from "@/components/pipecat/text-input";
import { UserAudioControl } from "@/components/pipecat/user-audio-control";
import { Metric } from "@/components/pipecat/metric";
import { usePipecatApp } from "@/hooks/use-pipecat-app";
import { useMediaQuery } from "@/hooks/use-media-query";
import { usePipecatMetricValue } from "@/hooks/use-pipecat-metrics";

const DITHER = { levels: 12, alphaLevels: 2 } as const;

function Metrics({
  ttfb,
  processing,
}: {
  ttfb: number | null;
  processing: number | null;
}) {
  return (
    <Panel title="metrics">
      <div className="grid grid-cols-2 gap-4 p-4 pt-6">
        <Metric
          label="time to first byte"
          value={ttfb == null ? null : ttfb * 1000}
          unit="ms"
        />
        <Metric
          label="processing"
          value={processing == null ? null : processing * 1000}
          unit="ms"
        />
      </div>
    </Panel>
  );
}

function Composer() {
  return (
    <div className="flex items-center gap-2 border-t pt-3">
      <TextInput className="min-w-0 flex-1" />
      <UserAudioControl />
    </div>
  );
}

function Session({
  connect,
  disconnect,
  error,
  endpoint,
  setEndpoint,
}: {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
  endpoint: string;
  setEndpoint: (value: string) => void;
}) {
  const state = usePipecatClientTransportState();
  const desktop = useMediaQuery("(min-width: 768px)");
  // Collect while mobile drawers are closed.
  const ttfb = usePipecatMetricValue("ttfb");
  const processing = usePipecatMetricValue("processing");
  const live = state === "ready" || state === "connected";
  const starting = [
    "initializing",
    "authenticating",
    "authenticated",
    "connecting",
  ].includes(state);
  const busy = live || starting || state === "disconnecting";
  return (
    <div className="flex h-svh min-h-[32rem] flex-col gap-5 p-3 text-[13px] leading-relaxed sm:p-5">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-baseline gap-2 text-base">
          <strong>pipecat</strong>
          <span className="text-muted-foreground">/</span>
          <span className="text-agent-foreground">ui</span>
          <span className="text-muted-foreground text-xs">
            reference client
          </span>
        </h1>
        <ConnectButton onConnect={connect} onDisconnect={disconnect} />
      </header>
      <main className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-5 md:grid-cols-[1.45fr_1fr]">
        <Panel
          title="agent"
          status={
            <span className={live ? "text-active" : "text-muted-foreground"}>
              {live ? "live" : starting ? "connecting" : "idle"}
            </span>
          }
          className="flex min-h-0 min-w-0 flex-col"
        >
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <AudioVisualizerWave
              participantType="bot"
              size={520}
              isConnecting={starting}
              color="--agent-foreground"
              accentColor="--client-foreground"
              colorShift={0.4}
              noHighlight
              amplitude={0.5}
              fill={0.85}
              hollow={0.2}
              core={0.3}
              density={0.32}
              glow={0.55}
              dither={DITHER}
              className="aspect-square h-auto! max-w-full shrink-0"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <AudioVisualizerBar
                participantType="bot"
                isConnecting={starting}
                barCount={16}
                barWidth={3}
                barGap={5}
                barOrigin="center"
                barMaxHeight={72}
                barLineCap="square"
              />
            </div>
          </div>
          <div className="shrink-0 px-4 pb-4">
            <p
              role={error ? "alert" : "status"}
              className={
                error
                  ? "text-inactive mb-3 break-words"
                  : "text-muted-foreground mb-3 text-center"
              }
            >
              {error ??
                (live
                  ? "Your agent is listening. Speak or send a message."
                  : starting
                    ? "Starting your session…"
                    : "Connect to your Pipecat bot to get started.")}
            </p>
            {!desktop && <Composer />}
          </div>
        </Panel>
        {desktop && (
          <div className="flex min-h-0 flex-col gap-5">
            <Panel title="transcript" className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-5 pb-4">
                <Conversation />
                <Composer />
              </div>
            </Panel>
            <Metrics ttfb={ttfb} processing={processing} />
          </div>
        )}
      </main>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <span
          className={
            error
              ? "text-inactive"
              : live
                ? "text-active"
                : "text-muted-foreground"
          }
        >
          ▸ session{" "}
          {error ? "error" : live ? "live" : starting ? "starting" : "idle"}
        </span>
        <div className="flex flex-wrap gap-2">
          {!desktop && (
            <Tray label="transcript" description="Conversation with your agent">
              <Conversation />
            </Tray>
          )}
          {!desktop && (
            <Tray
              label="metrics"
              description="Session timing reported by your bot"
            >
              <Metrics ttfb={ttfb} processing={processing} />
            </Tray>
          )}
          <Tray
            label="connection"
            description="Configure your Pipecat bot endpoint"
          >
            <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
              <h2 className="text-agent-foreground text-lg">
                Connect your bot
              </h2>
              <p className="text-muted-foreground">
                Use your bot's SmallWebRTC start endpoint. This reference app
                runs entirely in your browser.
              </p>
              <label htmlFor="endpoint">Start endpoint</label>
              <input
                id="endpoint"
                type="url"
                value={endpoint}
                disabled={busy}
                onChange={(event) => setEndpoint(event.target.value)}
                className="bg-input border p-3 disabled:opacity-50"
              />
              <p className="text-muted-foreground">
                Your bot must allow requests from this app's origin. Disconnect
                before changing the endpoint.
              </p>
              <a
                href="https://ui.pipecat.ai/docs/hooks/use-pipecat-app"
                className="text-client-foreground underline"
              >
                Connection setup documentation
              </a>
            </div>
          </Tray>
        </div>
      </footer>
      <BotAudioOutput />
    </div>
  );
}

export default function App() {
  const [endpoint, setEndpoint] = useState(
    import.meta.env.VITE_BOT_START_URL || "http://localhost:7860/start",
  );
  const app = usePipecatApp({
    transportType: "smallwebrtc",
    transportFactory: async (options) => {
      const { SmallWebRTCTransport } =
        await import("@pipecat-ai/small-webrtc-transport");
      return new SmallWebRTCTransport(options);
    },
    connectParams: { endpoint },
  });
  if (!app.client)
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <p role={app.error ? "alert" : "status"}>
          {app.error ?? "Starting client…"}
        </p>
      </main>
    );
  return (
    <PipecatClientProvider client={app.client}>
      <Session {...app} endpoint={endpoint} setEndpoint={setEndpoint} />
    </PipecatClientProvider>
  );
}
