import { useEffect, useReducer, useState } from "react";

import {
  DUPLEX_TIMELINE_INITIAL_STATE,
  reduceDuplexTimeline,
  type DuplexTimelineEvent,
} from "@/components/pipecat/duplex-timeline-markers";

type Voice = "agent" | "user";

type Step =
  | { at: number; talk: Voice; ms: number }
  | {
      at: number;
      event: Exclude<
        DuplexTimelineEvent["type"],
        "bot-backchannel" | "user-backchannel"
      >;
    }
  | { at: number; event: "bot-backchannel" | "user-backchannel"; text: string };

/**
 * One loop of a conversation: a reply, a user "mm-hmm" under it, a bot
 * backchannel during the user's turn, a slow reply the user talks over, and
 * the reply after the interruption. Events trail the audio like a real bot's.
 */
const SCRIPT: Step[] = [
  { at: 0, talk: "user", ms: 2200 },
  { at: 150, event: "user-started-speaking" },
  { at: 2350, event: "user-stopped-speaking" },
  { at: 2950, event: "bot-started-speaking" },
  { at: 2950, talk: "agent", ms: 3400 },
  { at: 4300, talk: "user", ms: 380 },
  { at: 4800, event: "user-backchannel", text: "Mm-hmm." },
  { at: 6350, event: "bot-stopped-speaking" },
  { at: 7300, talk: "user", ms: 2300 },
  { at: 7450, event: "user-started-speaking" },
  { at: 8300, event: "bot-started-speaking" },
  { at: 8300, event: "bot-backchannel", text: "Mm-hmm." },
  { at: 8300, talk: "agent", ms: 420 },
  { at: 8750, event: "bot-stopped-speaking" },
  { at: 9750, event: "user-stopped-speaking" },
  { at: 10950, event: "bot-started-speaking" },
  { at: 10950, talk: "agent", ms: 2350 },
  { at: 12700, talk: "user", ms: 1800 },
  { at: 13000, event: "user-started-speaking" },
  { at: 13300, event: "bot-stopped-speaking" },
  { at: 14600, event: "user-stopped-speaking" },
  { at: 15200, event: "bot-started-speaking" },
  { at: 15200, talk: "agent", ms: 1600 },
  { at: 16800, event: "bot-stopped-speaking" },
];
const LOOP_MS = 19500;

/** Speech-like noise: a walking formant with syllable bursts, silent between talks. */
function createVoice(ctx: AudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const formant = ctx.createBiquadFilter();
  formant.type = "bandpass";
  formant.frequency.value = 500;
  formant.Q.value = 2;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const destination = ctx.createMediaStreamDestination();
  noise.connect(formant);
  formant.connect(gain);
  gain.connect(destination);
  noise.start();

  let until = 0;
  let timer = 0;
  const syllable = () => {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    if (performance.now() >= until) {
      gain.gain.linearRampToValueAtTime(0, t + 0.06);
      timer = 0;
      return;
    }
    formant.frequency.setTargetAtTime(250 + Math.random() * 1800, t, 0.02);
    gain.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.5, t + 0.04);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.16 + Math.random() * 0.1);
    timer = window.setTimeout(syllable, 120 + Math.random() * 110);
  };

  return {
    track: destination.stream.getAudioTracks()[0] ?? null,
    talk(ms: number) {
      until = performance.now() + ms;
      if (!timer) syllable();
    },
    stop() {
      clearTimeout(timer);
      noise.stop();
    },
  };
}

/**
 * Plays the scripted conversation on two synthetic tracks while active and
 * reduces its events into timeline markers, so the timeline runs without a bot.
 */
export function useDuplexDemo(active: boolean) {
  const [tracks, setTracks] = useState<{
    agent: MediaStreamTrack | null;
    user: MediaStreamTrack | null;
  }>({ agent: null, user: null });
  const [state, dispatch] = useReducer(
    reduceDuplexTimeline,
    DUPLEX_TIMELINE_INITIAL_STATE,
  );

  useEffect(() => {
    if (!active) return;
    const ctx = new AudioContext();
    const voices = { agent: createVoice(ctx), user: createVoice(ctx) };
    setTracks({ agent: voices.agent.track, user: voices.user.track });
    dispatch({ type: "connected", now: performance.now() });

    const timers: number[] = [];
    const run = (step: Step) => {
      const now = performance.now();
      if ("talk" in step) voices[step.talk].talk(step.ms);
      else if ("text" in step) {
        dispatch({ type: step.event, text: step.text, now });
      } else dispatch({ type: step.event, now });
    };
    const loop = () => {
      // The previous loop's steps have all fired.
      timers.length = 0;
      for (const step of SCRIPT) {
        timers.push(window.setTimeout(() => run(step), step.at));
      }
      timers.push(window.setTimeout(loop, LOOP_MS));
    };
    loop();

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      voices.agent.stop();
      voices.user.stop();
      void ctx.close();
      setTracks({ agent: null, user: null });
      dispatch({ type: "disconnected", now: performance.now() });
    };
  }, [active]);

  return {
    agentTrack: tracks.agent,
    userTrack: tracks.user,
    markers: state.markers,
    agentSpeaking: state.botSpeaking,
    userSpeaking: state.userSpeaking,
  };
}
