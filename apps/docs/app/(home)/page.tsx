import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HeroInstallCommand } from "@/components/hero-install-command";
import { HomeVisual } from "@/components/home-visual";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <div className={`${styles.home} relative isolate flex flex-1 flex-col`}>
      <div className={styles.backdrop} aria-hidden="true" />
      <section
        aria-labelledby="hero-title"
        className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-4 px-6 pt-14 pb-8 sm:px-10 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-0 lg:py-24"
      >
        <div className="relative z-10 flex min-w-0 flex-col items-start">
          <h1
            id="hero-title"
            className="max-w-xl text-[clamp(2.25rem,5.3vw,4.5rem)] leading-[1.05] font-semibold tracking-[-0.055em]"
          >
            <span className="block">Components for</span>{" "}
            <span className="block">Pipecat and</span>{" "}
            <span className="text-sky-700 dark:text-sky-300">Voice AI</span>
          </h1>
          <p className="text-fd-muted-foreground mt-6 max-w-md text-base leading-relaxed sm:text-lg">
            Components, hooks, visualizers, and composable blocks, installed
            with shadcn and styled by your theme.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/docs"
              className="bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/90 focus-visible:ring-fd-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-5"
            >
              Documentation
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/docs/components"
              className="bg-fd-background/60 hover:bg-fd-accent focus-visible:ring-fd-ring inline-flex min-h-11 items-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-5"
            >
              Browse components
            </Link>
          </div>
          <div className="mt-6 flex max-w-full">
            <HeroInstallCommand />
          </div>
        </div>
        <HomeVisual />
      </section>
    </div>
  );
}
