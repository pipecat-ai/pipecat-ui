"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const prefix = "npx shadcn@latest add";
const components = [
  "user-audio-control",
  "connect-button",
  "conversation",
  "audio-visualizer-wave",
];
const nameWidth = Math.max(...components.map((name) => name.length));
const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotion() {
  return window.matchMedia(motionQuery).matches;
}

function getServerReducedMotion() {
  return true;
}

export function HeroInstallCommand() {
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  const [frame, setFrame] = useState({
    index: 0,
    length: components[0].length,
    deleting: true,
  });

  useEffect(() => {
    if (reducedMotion) return;

    const { index, length, deleting } = frame;
    const delay =
      length === components[index].length
        ? 2200
        : length === 0
          ? 250
          : deleting
            ? 35
            : 65;
    const timer = setTimeout(() => {
      const nextLength = length + (deleting ? -1 : 1);
      setFrame({
        index: nextLength === 0 ? (index + 1) % components.length : index,
        length: nextLength,
        deleting:
          nextLength !== 0 &&
          (deleting || nextLength === components[index].length),
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [reducedMotion, frame]);

  const name = reducedMotion ? components[0] : components[frame.index];

  return (
    <code
      className="bg-fd-secondary max-w-full rounded-lg border px-4 py-2.5 font-mono text-xs sm:text-sm"
      onCopy={(event) => {
        event.clipboardData.setData("text/plain", `${prefix} @pipecat/${name}`);
        event.preventDefault();
      }}
    >
      <span className="sr-only">{`${prefix} @pipecat/${components[0]}`}</span>
      <span
        aria-hidden="true"
        className="flex flex-wrap justify-center gap-x-[1ch] gap-y-1"
      >
        <span>{prefix}</span>
        <span className="whitespace-nowrap">
          @pipecat/
          <span
            className="inline-block text-left"
            style={{ width: `${nameWidth + 1}ch` }}
          >
            {reducedMotion ? name : name.slice(0, frame.length)}
            <span className="bg-fd-foreground ml-px inline-block h-[1em] w-px translate-y-0.5 animate-pulse motion-reduce:hidden" />
          </span>
        </span>
      </span>
    </code>
  );
}
