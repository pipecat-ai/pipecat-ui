import { AudioLines, MessageSquare, PlugZap } from "lucide-react";
import styles from "./home-visual.module.css";

const waves = Array.from({ length: 25 }, (_, line) => {
  const offset = (line - 12) / 12;
  return Array.from({ length: 61 }, (_, point) => {
    const t = point / 60;
    const envelope = Math.sin(Math.PI * t) ** 1.4;
    const x = 35 + t * 490;
    const y =
      260 +
      Math.sin(t * Math.PI * 2 - 0.8) * envelope * 85 +
      offset * (10 + envelope * 90);
    return `${point === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
});

const bubbles = [
  {
    icon: PlugZap,
    position: "top-[20.8%] left-[20%]",
  },
  {
    icon: AudioLines,
    position: "top-[41%] left-[86.4%]",
  },
  {
    icon: MessageSquare,
    position: "top-[79.8%] left-[27.1%]",
  },
];

export function HomeVisual() {
  return (
    <div
      className="pointer-events-none relative mx-auto aspect-[560/520] w-full max-w-xl lg:scale-105"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 560 520"
        fill="none"
        className="size-full text-sky-500 dark:text-sky-400"
        focusable="false"
      >
        <defs>
          <radialGradient id="home-signal-glow">
            <stop stopColor="currentColor" stopOpacity=".16" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id="home-signal-wave"
            x1="60"
            y1="160"
            x2="500"
            y2="340"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--color-sky-300)" stopOpacity=".2" />
            <stop offset=".3" stopColor="currentColor" />
            <stop offset=".7" stopColor="currentColor" />
            <stop
              offset="1"
              stopColor="var(--color-sky-300)"
              stopOpacity=".3"
            />
          </linearGradient>
        </defs>
        <circle cx="280" cy="260" r="245" fill="url(#home-signal-glow)" />
        <g stroke="currentColor" className="text-fd-foreground">
          <circle cx="280" cy="260" r="198" opacity=".06" />
          <circle
            cx="280"
            cy="260"
            r="164"
            strokeDasharray="2 7"
            opacity=".13"
          />
          <circle cx="280" cy="260" r="126" opacity=".06" />
          <path d="M35 260H525M280 35V485" strokeDasharray="3 7" opacity=".1" />
          <path
            d="M112 108V148L170 206M484 213V260M152 415V371L205 326"
            opacity=".18"
          />
        </g>
        <g stroke="url(#home-signal-wave)" strokeWidth="1.2">
          {waves.map((d, index) => (
            <path
              key={index}
              d={d}
              className={styles.wave}
              style={{ animationDelay: `${index * -0.12}s` }}
            />
          ))}
        </g>
        <g fill="currentColor">
          <circle cx="170" cy="206" r="3" />
          <circle cx="484" cy="260" r="3" />
          <circle cx="205" cy="326" r="3" />
        </g>
        <g stroke="currentColor" opacity=".25">
          <path d="M276 62H284M280 58V66M78 260H86M82 256V264M276 458H284M280 454V462M474 260H482M478 256V264" />
        </g>
      </svg>
      {bubbles.map(({ icon: Icon, position }) => (
        <div
          key={position}
          className={`absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-sky-200/70 bg-sky-50/90 text-sky-700 shadow-lg shadow-sky-950/5 sm:size-14 dark:border-sky-700/50 dark:bg-sky-950/80 dark:text-sky-300 ${position}`}
        >
          <Icon className="size-5 sm:size-6" strokeWidth={1.5} />
        </div>
      ))}
      <div className="text-fd-muted-foreground absolute inset-x-0 bottom-[3%] text-center font-mono text-[10px] tracking-[0.18em] uppercase">
        Designed for Pipecat.
      </div>
    </div>
  );
}
