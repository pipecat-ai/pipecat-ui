import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { DuplexTimelineView } from "@/components/pipecat/duplex-timeline";

import { useDuplexDemo } from "../fixtures/duplex-demo";

function useMicrophoneTrack(enabled: boolean) {
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    void navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      if (cancelled) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = s;
      setTrack(s.getAudioTracks()[0] ?? null);
    });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setTrack(null);
    };
  }, [enabled]);

  return track;
}

const meta = {
  title: "Components/DuplexTimeline",
  component: DuplexTimelineView,
  args: {
    agentLabel: "agent",
    userLabel: "you",
    slowReplyMs: 1000,
  },
  decorators: [
    (Story) => (
      <div className="w-[48rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DuplexTimelineView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Scripted: Story = {
  render: (args) => {
    const ScriptedStory = () => {
      const [running, setRunning] = useState(true);
      const demo = useDuplexDemo(running);
      return (
        <div className="flex flex-col gap-4">
          <DuplexTimelineView {...args} {...demo} running={running} />
          <button
            className="text-muted-foreground self-start font-mono text-xs underline"
            onClick={() => setRunning((v) => !v)}
          >
            {running ? "stop" : "restart"}
          </button>
        </div>
      );
    };
    return <ScriptedStory />;
  },
};

export const Microphone: Story = {
  render: (args) => {
    const MicStory = () => {
      const [enabled, setEnabled] = useState(false);
      const track = useMicrophoneTrack(enabled);
      return (
        <div className="flex flex-col gap-4">
          <DuplexTimelineView {...args} userTrack={track} running={enabled} />
          <button
            className="text-muted-foreground self-start font-mono text-xs underline"
            onClick={() => setEnabled((v) => !v)}
          >
            {enabled ? "stop microphone" : "use microphone"}
          </button>
        </div>
      );
    };
    return <MicStory />;
  },
};
