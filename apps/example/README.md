# Pipecat UI reference client

A browser-only Vite app showing how to compose installed Pipecat UI components.
The dark theme and dithered aura come from phonellm; the mobile transcript and
metrics drawers follow turkcat's responsive layout.

From the repository root:

```sh
pnpm install
pnpm --filter @pipecat-ui/example dev
```

Open `http://localhost:3700`. Start your own SmallWebRTC bot, then set its start
endpoint in **Connection** (default `http://localhost:7860/start`). You can also
set `VITE_BOT_START_URL` in `.env.local`. The bot must allow this origin through
CORS. No server or private credentials belong in this app.

`App.tsx` supplies a lazy factory for the one transport installed here. The
remaining transports are not dependencies. The hook returns initialization and
connection failures for the UI to display.

`components/pipecat`, `hooks/use-pipecat-*` and `lib` contain registry source
copies, as they would in a consumer app. `components/demo` contains app-specific
composition and the dithered visualizer variant. These customizations demonstrate
editing your copy without adding demo-only props to the registry.

This app is built in CI for verification and is not deployed.
