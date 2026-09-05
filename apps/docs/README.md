# Pipecat UI docs

This Next.js and Fumadocs app serves the documentation and generated registry at
`https://ui.pipecat.ai`. Storybook deploys separately and is proxied at `/storybook/`.

From the repository root:

```bash
pnpm --filter @pipecat-ui/docs dev    # http://localhost:3600
pnpm --filter @pipecat-ui/docs build
```

Both commands build the registry and copy its JSON to `public/r/`. Edit
`packages/registry/src` and `packages/registry/registry.json`; generated files
are ignored. Documentation lives in `content/docs/`.

See the [root README](../../README.md) for Vercel setup and
[AGENTS.md](../../AGENTS.md) for development conventions.
