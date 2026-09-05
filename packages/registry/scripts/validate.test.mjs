import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  importsOf,
  parseDependency,
  registryRoot,
  validateArtifacts,
  validateRegistry,
} from "./validate.mjs";

const manifest = () =>
  JSON.parse(fs.readFileSync(path.join(registryRoot, "registry.json"), "utf8"));

test("the shipped registry passes validation and excludes console", () => {
  const registry = validateRegistry();
  assert(!registry.items.some((item) => item.name === "console"));
  assert(
    !registry.items.some((item) =>
      item.files.some((file) => file.path.startsWith("src/blocks/console/")),
    ),
  );
});

test("dependency parsing rejects floating majors and bare names", () => {
  for (const value of [
    "zustand",
    "zustand@latest",
    "zustand@*",
    "zustand@>=5",
    "@pipecat-ai/client-js@1",
  ]) {
    assert.throws(() => parseDependency(value));
  }
  assert.deepEqual(parseDependency("@pipecat-ai/client-js@^1.13.0"), {
    name: "@pipecat-ai/client-js",
    range: "^1.13.0",
  });
});

test("import analysis includes type imports, re-exports and dynamic imports", () => {
  assert.deepEqual(
    importsOf(
      `
    // import 'fake';
    import type { A } from "types";
    export { b } from "external";
    const c = import("optional");
    type D = import("type-query").D;
  `,
      "sample.ts",
    ),
    [
      { specifier: "types", dynamic: false },
      { specifier: "external", dynamic: false },
      { specifier: "optional", dynamic: true },
      { specifier: "type-query", dynamic: false },
    ],
  );
});

test("metrics cannot rely on chart to provide recharts transitively", () => {
  const registry = manifest();
  registry.items.find((item) => item.name === "metrics").dependencies = [];
  assert.throws(() => validateRegistry(registry), /metrics: dependencies/);
});

test("SDK peers must remain constrained even without a direct import", () => {
  const registry = manifest();
  const item = registry.items.find(
    (item) => item.name === "audio-visualizer-bar",
  );
  item.dependencies = item.dependencies.filter(
    (dep) => !dep.startsWith("@pipecat-ai/client-js@"),
  );
  assert.throws(
    () => validateRegistry(registry),
    /audio-visualizer-bar: dependencies/,
  );
});

test("unused dependencies are rejected", () => {
  const registry = manifest();
  registry.items.find((item) => item.name === "metric").dependencies = [
    manifest()
      .items.find((item) => item.name === "use-pipecat-metrics")
      .dependencies.find((dep) => dep.startsWith("zustand@")),
  ];
  assert.throws(() => validateRegistry(registry), /metric: dependencies/);
});

test("unknown registry dependencies and cycles are rejected", () => {
  for (const name of ["missing", "connect-button"]) {
    const registry = manifest();
    registry.items[0].registryDependencies.push(`@pipecat/${name}`);
    assert.throws(
      () => validateRegistry(registry),
      /unknown registry dependency|dependency cycle/,
    );
  }
});

test("missing bundled files and unsafe targets are rejected", () => {
  const registry = manifest();
  registry.items.find((item) => item.name === "conversation").files.pop();
  assert.throws(() => validateRegistry(registry), /unshipped import/);
  const unsafe = manifest();
  unsafe.items[0].files[0].target = "../outside.tsx";
  assert.throws(() => validateRegistry(unsafe), /unsafe target/);
});

test("artifact validation preserves deprecation metadata and rejects stale output", () => {
  const output = fs.mkdtempSync(
    path.join(os.tmpdir(), "pipecat-registry-test-"),
  );
  try {
    const registry = manifest();
    registry.items[0].meta = {
      deprecated: { reason: "Use the replacement item." },
    };
    fs.writeFileSync(
      path.join(output, "registry.json"),
      JSON.stringify(registry),
    );
    for (const item of registry.items) {
      const built = {
        $schema: "https://ui.shadcn.com/schema/registry-item.json",
        ...item,
        files: item.files.map((file) => ({
          ...file,
          content: fs.readFileSync(path.join(registryRoot, file.path), "utf8"),
        })),
      };
      fs.writeFileSync(
        path.join(output, `${item.name}.json`),
        JSON.stringify(built),
      );
    }
    validateArtifacts(output, registry);
    fs.writeFileSync(path.join(output, "console.json"), "{}");
    assert.throws(
      () => validateArtifacts(output, registry),
      /missing or stale items/,
    );
    fs.unlinkSync(path.join(output, "console.json"));
    const file = path.join(output, `${registry.items[0].name}.json`);
    const built = JSON.parse(fs.readFileSync(file, "utf8"));
    built.files[0].content = "wrong content";
    fs.writeFileSync(file, JSON.stringify(built));
    assert.throws(
      () => validateArtifacts(output, registry),
      /artifact does not match/,
    );
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});
