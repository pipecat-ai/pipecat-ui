# Working on Pipecat UI

Keep this repository small. Prefer framework and tool defaults to custom scripts.
Add infrastructure only when it solves a demonstrated problem. Do not introduce
per-component releases, generated source stamps, or a separate registry deploy.

## Workspace and delivery

- Use pnpm, the version in `packageManager`, and the Node version in `.nvmrc`.
- `packages/registry/src` is the source consumers install. `registry.json` declares
  its files, direct dependencies, shadcn primitives and CSS. Console is a local
  preview only. Do not add it back to the registry without a product decision.
- `apps/docs` builds and serves both documentation and `/r/{name}.json` at
  `ui.pipecat.ai`. Generated payloads are ignored. Edit source and the manifest.
- `apps/storybook` hosts component development and Vitest, and deploys as a
  separate Vercel app proxied by docs at `/storybook/`. Link component docs to
  their stories. `apps/example` is a
  client-only reference app; never add a backend or production deployment to it.
- Merges to `main` are the deployment loop. Change the repository version locally
  in root `package.json` when releasing; CI must not bump it or open version PRs.
  The Vercel GitHub integration deploys docs and Storybook; do not add CLI
  deployments. A successful docs deployment plus passing CI creates a release
  only for a new version.
- Keep Turbo tasks in `turbo.json`. Declare workspace dependencies for shared
  code; include cross-package inputs where aliases bypass that graph. Cache
  deterministic build outputs only; development servers are persistent/uncached.
  Avoid wrappers that repeat Turbo's orchestration or create separate pipelines.

## Composing components

Follow [installation](apps/docs/content/docs/installation.mdx) for registry setup.
Check exported props and co-located stories before using an API; see
[the reference client](apps/example/src/App.tsx) for a complete composition.

- Connected exports (`Conversation`, `UserAudioControl`, etc.) read a shared
  `PipecatClientProvider`. Use available `*View` exports with your own data and
  callbacks when no client is needed. `Metric` is already props-driven.
- Own the client above responsive panels. Use an existing client with the
  provider, or `usePipecatApp` with a lazy factory for the installed transport.
  Handle its null client and error states; pass its `connect`/`disconnect` to
  `ConnectButton` as `onConnect`/`onDisconnect` so bot startup runs correctly.
  Remount the hook owner to change constructor options or the factory.
- Compose `Conversation` + `TextInput` for chat, `UserAudioControl` for mic/device
  controls, and video/screen controls as needed. Keep page layout in the app;
  style copied components through `className` and theme tokens.
- Role labels use `text-agent-foreground` / `text-client-foreground`. Pair them
  with `bg-agent` / `bg-client` for optional role surfaces; these map to the
  corresponding `--agent-background` / `--client-background` tokens.
- Mount `BotAudioOutput` once inside the provider, in place of
  `PipecatClientAudio`. Bot volume controls depend on it; visualizers do not
  play audio.
- Connected visualizers select audio with `participantType`; their views accept
  a `track`. Supply `isConnecting`/`isThinking` explicitly when needed; speech
  activity comes from the track.
- Keep a metrics/event-stream hook mounted above conditional tabs or drawers
  when collection must continue while they are closed. Metrics, events and
  bot-volume stores are shared at module scope; separate providers do not
  isolate concurrent sessions.

## React and TypeScript

- Keep comments terse. Explain constraints, lifecycle ownership, defaults or a
  surprising code path. Remove narration, section banners and repeated API
  tutorials; put examples in docs. Published components need useful contracts,
  not a comment on every prop or statement.

- Use function components, TypeScript, named exports and explicit exported props.
  Prefer SDK and primitive types to parallel unions. Avoid `any` and suppression
  comments; narrow unknown input at boundaries.
- Compose stock shadcn `base-nova` primitives. Use Base UI's `render` API, `cn`,
  theme tokens, and `data-slot`/`data-state`. Preserve accessible names, keyboard
  operation, focus handling and reduced-motion preferences.
- Keep render pure. Derive values during render instead of mirroring props or
  derived data into state. Put user actions in event handlers.
- Use effects only to synchronize with external systems: SDK subscriptions,
  media devices, timers, canvas, or browser APIs. Clean them up and handle stale
  asynchronous work and Strict Mode remounts. Do not silence dependency rules
  to control timing. Use `useSyncExternalStore` for external store subscriptions.
- Use refs for imperative handles and values that do not drive rendering. Add
  `useMemo`/`useCallback` for a measured cost or required identity, not by habit.
- Separate connected components from props-driven `*View` components when useful
  for consumers and stories. Keep simple components simple; avoid speculative
  abstractions, broad context providers and unnecessary global state.
- Transport imports must be lazy and optional. Never import every transport in
  shipped source, and never use ignored bare dynamic imports that cannot resolve
  in a production browser. Surface load failures through the hook's error state.

## Formatting, hooks and checks

- ESLint owns correctness; Prettier owns formatting and Tailwind class ordering.
  Run `pnpm format` instead of hand-maintaining formatting. Do not add overlapping
  formatters or package-local copies of root configuration.
- Husky runs `lint-staged` before commits and commitlint on commit messages.
  Keep hooks short and local. Full builds and tests belong in CI. Do not bypass
  hooks or weaken rules to make a change pass.
- Use conventional commit messages and PR titles (`fix:`, `feat:`, `docs:`, etc.).
  CI checks titles because squash merges use them.
- Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` for broad changes. Use Turbo filters for focused iteration.
- For registry manifest/dependency changes, run `pnpm registry:check` and a real
  `pnpm registry:install-test <item>` after building. The reference app's existing
  copies are not proof that a fresh installation works.
- Test behavior and failure paths, especially asynchronous lifecycle and optional
  dependency loading. Do not add tests that merely duplicate implementation or
  assert cosmetic text. Keep one useful story, test and docs page per shipped item.
- Third-party dependency ranges use a current tested minimum (`^x.y.z`). TypeScript
  stays on `~6.0.3` until typescript-eslint supports the TypeScript 7 API. Keep
  registry ranges aligned with the workspace and commit the lockfile. Preserve
  npm aliases when updating dependencies.
