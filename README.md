# Pipecat UI

[![Docs](https://img.shields.io/badge/docs-ui.pipecat.ai-blue)](https://ui.pipecat.ai)
[![Storybook](https://img.shields.io/badge/storybook-browse-ff4785?logo=storybook&logoColor=white)](https://ui.pipecat.ai)
[![Status](https://img.shields.io/badge/status-v1_beta-orange)](https://github.com/pipecat-ai/pipecat-ui)

> [!IMPORTANT]
> Pipecat UI is a shadcn rebuild of the
> [Voice UI Kit repository](https://github.com/pipecat-ai/voice-ui-kit), which
> will soon be deprecated. Components now install as source through the shadcn
> CLI, replacing the previous npm package distribution (≤0.13.x).

<!-- TODO: point the Storybook badge at the hosted Storybook once it's live -->

<img width="100%" src="image.png" alt="Pipecat UI components" />

The UI layer for voice agents. Pipecat UI is a
[shadcn registry](https://ui.shadcn.com/docs/registry) of components for
building on [Pipecat](https://github.com/pipecat-ai/pipecat)'s real-time
platform — mic and camera controls, live transcripts with karaoke text,
voice-tuned audio visualizers, session state, and more, already wired to the
client. Components install as source into your project, styled by your theme
and yours to edit.

## What's inside

- 🎛️ **Session controls** — connect button driven by transport state, mic
  control with push-to-talk and a live visualizer, camera and screen-share
  toggles with preview tiles, device pickers, DTMF keypad
- 📈 **Audio visualizers** — canvas bar and radial renderers plus a WebGL wave
  renderer sharing a voice-tuned mel-band core
- 💬 **Conversation UI** — live scrolling transcript with roles and karaoke
  text, message composer, caption-style overlay for bot speech
- 🔍 **Session insight** — client/agent status rows, session metadata, bot
  audio output with a shared volume store
- 🪝 **Bootstrap hook** — `use-pipecat-app` builds the client and owns the
  connect lifecycle, using the transport factory you supply
- 🧱 **Blocks** — a metrics dashboard composed from the components; the console
  remains a local development preview and is not published in the registry
- 🎨 **Your theme, your code** — stock Base UI primitives, `data-state`
  attributes on everything, a tiny semantic token set you can restyle

Every component ships two layers in one file: a connected export wired to the
Pipecat client, and a props-driven `*View` export for custom state management.

## Prerequisites

- **Node.js** 22+
- **React** 19
- **Tailwind CSS** 4
- **[shadcn/ui](https://ui.shadcn.com/docs/installation)** — **`base-nova` style**
  (Base UI primitives)

> [!NOTE]
> Everything else — shadcn primitives, the Pipecat client SDKs, npm deps —
> installs automatically with each component. The only optional install is a
> `@pipecat-ai/*-transport` package for connecting (see
> [transports](#pipecat--connected-or-optional)).

## Installation

1. Register the `@pipecat` namespace in your `components.json`:

```jsonc
{
  "registries": {
    "@pipecat": "https://ui.pipecat.ai/r/{name}.json",
  },
}
```

2. Add components:

```bash
npx shadcn@latest add @pipecat/user-audio-control @pipecat/conversation
```

Files land in `components/pipecat/`, dependencies install, and any component
theme tokens merge into your globals.css.

3. Wrap your app in a `PipecatClientProvider`
   ([docs](https://docs.pipecat.ai/client/react/introduction)) — every
   component works under a bare provider. Or let the kit do it:

```tsx
"use client";

import { PipecatClientProvider } from "@pipecat-ai/client-react";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";

import { ConnectButton } from "@/components/pipecat/connect-button";
import { Conversation } from "@/components/pipecat/conversation";
import { UserAudioControl } from "@/components/pipecat/user-audio-control";
import { usePipecatApp } from "@/hooks/use-pipecat-app";

export default function VoiceApp() {
  const { client, connect, disconnect } = usePipecatApp({
    transportFactory: () => new SmallWebRTCTransport(),
    connectParams: { endpoint: "/api/start" },
  });

  if (!client) return null;

  return (
    <PipecatClientProvider client={client}>
      <Conversation />
      <UserAudioControl />
      <ConnectButton onConnect={connect} onDisconnect={disconnect} />
    </PipecatClientProvider>
  );
}
```

## Pipecat — connected, or optional

The connected exports read the Pipecat client from context, so they need a
`PipecatClientProvider`. But every component also exports a `*View` variant
(`UserAudioControlView`, `ConversationView`, …) that is pure props-driven UI —
no provider, no connection, no side effects. Drive the views from mocks, tests,
recorded sessions, or a non-Pipecat backend entirely.

The client SDKs (`@pipecat-ai/client-js`, `@pipecat-ai/client-react`) install
automatically with each component. **Transport packages stay optional** — they
are imported by your app and passed as `transportFactory`, so install only the
one your app actually connects with:

| Transport             | Package                              |
| --------------------- | ------------------------------------ |
| SmallWebRTC (default) | `@pipecat-ai/small-webrtc-transport` |
| Daily                 | `@pipecat-ai/daily-transport`        |
| WebSocket             | `@pipecat-ai/websocket-transport`    |
| MoQ                   | `@pipecat-ai/moq-transport`          |

For lazy loading, pass an async factory that imports the selected package, or
register an app-owned loader with `registerTransport`. The shipped helper does
not import unused transports, so they do not need to be installed to build.

## Theme tokens

Components rely on your shadcn theme. Two small semantic groups are added via
registry `cssVars` (and are yours to restyle):
`--active-background`/`--active-foreground` and
`--inactive-background`/`--inactive-foreground` for media on/off states, plus
`--agent`/`--client` for conversation roles.

## Documentation

- **[Component docs](https://ui.pipecat.ai)** — live previews,
  configurable examples, and installation for every item
- **Storybook** — every component and state in isolation _(hosted link coming
  soon; run locally with `pnpm dev`)_
- **[Pipecat client SDK](https://docs.pipecat.ai/client/react/introduction)** —
  the provider, hooks, and transports the kit builds on
- **[Pipecat](https://docs.pipecat.ai)** — build the agent on the other side of
  the conversation

## Contributing

The monorepo is the registry plus two host apps that consume it like a real
project:

- `packages/registry` — the product: `registry.json` + source under
  `src/components/`, shared modules in `src/lib/`, hooks in
  `src/hooks/`, vitest suites in `tests/`
- `apps/docs` — Fumadocs site: component docs with live previews, serves the
  registry at `/r/{name}.json`
- `apps/storybook` — Storybook 10 dev host set up as a real Base UI shadcn
  consumer; also hosts the vitest run

```bash
pnpm install
pnpm dev        # storybook on :6006 + docs on :3600
pnpm build      # registry build + storybook build + docs build
pnpm registry:check # manifest, dependencies, source and coverage checks
pnpm typecheck && pnpm lint && pnpm test
```

To add a registry item:

1. Create `packages/registry/src/components/<name>.tsx` with a
   co-located `<name>.stories.tsx`
2. Add a test in `packages/registry/tests/<name>.test.tsx`
3. Add the item's manifest entry to `packages/registry/registry.json`
4. Run `node apps/docs/scripts/sync-registry.mjs`, then
   `pnpm typecheck && pnpm lint && pnpm test`

The docs app builds and serves the registry at `https://ui.pipecat.ai/r`.
Generated JSON is not committed. CI checks the manifest and fresh installations;
its build artifact is available for review. The example app is a client-only
reference, run locally with `pnpm --filter @pipecat-ui/example dev`.

Merges to `main` deploy the docs and registry together. Set the repository version
locally in root `package.json` when a release is needed; a successful deployment
creates a GitHub release if that version has not been released. Components do not
have independent versions. See [AGENTS.md](AGENTS.md) for development conventions.

Connect the repository through the Vercel GitHub integration with two projects:

| Project                | Root directory   | Output                         |
| ---------------------- | ---------------- | ------------------------------ |
| `pipecat-ui`           | `apps/docs`      | Next.js docs and `/r` registry |
| `pipecat-ui-storybook` | `apps/storybook` | `storybook-static`             |

Use `main` as each project's production branch and enable access to files outside
its root directory. Both apps include `vercel.json`; CI builds and validates them,
and the integration handles deployment without a CLI token. The example stays local.

Assign `ui.pipecat.ai` to the docs project. Its `/storybook/` route proxies to the
Storybook project; set `STORYBOOK_ORIGIN` in the docs project if the Storybook
production URL differs from `https://pipecat-ui-storybook.vercel.app`. That origin
must be publicly accessible for the proxy to work. Component pages link directly
to their stories.

The release workflow listens for the docs project's successful production
promotions, checks CI for that exact commit, and creates the repository version's
GitHub release if missing. If the docs project has a different name, set the
GitHub repository variable `VERCEL_DOCS_PROJECT`. Enable Vercel's repository
dispatch events. Use Vercel Deployment Checks if production promotion should
also wait for CI; the integration otherwise builds alongside GitHub Actions.

## Built with

[Base UI](https://base-ui.com) ·
[Tailwind CSS v4](https://tailwindcss.com) ·
[TypeScript](https://www.typescriptlang.org) ·
[shadcn CLI](https://ui.shadcn.com/docs/cli) ·
[Fumadocs](https://fumadocs.dev) ·
[Storybook 10](https://storybook.js.org) ·
[Vitest](https://vitest.dev) ·
[Turborepo](https://turborepo.dev)

## Community & support

- 💬 **[Discord](https://discord.gg/pipecat)** — chat with the Pipecat team and
  community
- 🐛 **[GitHub issues](https://github.com/pipecat-ai/pipecat-ui/issues)** —
  bugs and feature requests
