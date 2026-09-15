// Exceptions to import-based dependency checks must explain their purpose.
export const requiredPeers = {
  "@pipecat-ai/client-react": ["@pipecat-ai/client-js"],
};

export const styleDependencies = {
  "transcript-overlay": {
    "tw-animate-css": "Provides the animate-in/fade-in animation utilities.",
  },
};

export const unpublishedSources = {
  "src/fixtures/": "Storybook fixtures are development-only.",
};

export const storyExceptions = {
  "use-pipecat-app": "Exercised by the console block and dedicated hook tests.",
  "use-pipecat-metrics":
    "Exercised by metrics stories and dedicated hook tests.",
  "use-pipecat-event-stream":
    "Exercised by the console block and dedicated hook tests.",
};
