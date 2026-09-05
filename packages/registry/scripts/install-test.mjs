import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateArtifacts,
  validateRegistry,
  registryRoot,
} from "./validate.mjs";

const registry = validateRegistry();
const output = path.join(registryRoot, "public/r");
validateArtifacts(output, registry);
const requested = process.argv.slice(2);
const names = requested.length
  ? requested
  : [...registry.items.map((item) => item.name), "all"];
assert(
  names.every(
    (name) =>
      name === "all" || registry.items.some((item) => item.name === name),
  ),
  "Unknown install-test item",
);
const workspace = path.resolve(registryRoot, "../..");
const example = JSON.parse(
  fs.readFileSync(path.join(workspace, "apps/example/package.json")),
);
const pkg = JSON.parse(
  fs.readFileSync(path.join(registryRoot, "package.json")),
);
const exact = (range) => range.replace(/^[~^]/, "");
const cli = fileURLToPath(import.meta.resolve("shadcn"));

async function run(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      CI: "true",
      npm_config_audit: "false",
      npm_config_fund: "false",
    },
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, `${command} ${args.join(" ")} failed in ${cwd}`);
}

const server = http.createServer((req, res) => {
  const name = /^\/r\/([a-z0-9-]+)\.json$/.exec(req.url ?? "")?.[1];
  const file = name && path.join(output, `${name}.json`);
  if (!file || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(fs.readFileSync(file));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const endpoint = `http://127.0.0.1:${server.address().port}/r/{name}.json`;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "pipecat-install-"));
console.log(`Clean install workspaces: ${temporary}`);
try {
  for (const name of names) {
    const dir = path.join(temporary, name);
    fs.mkdirSync(path.join(dir, "src/lib"), { recursive: true });
    const write = (file, content) =>
      fs.writeFileSync(
        path.join(dir, file),
        typeof content === "string"
          ? content
          : JSON.stringify(content, null, 2) + "\n",
      );
    write("package.json", {
      name: `pipecat-install-${name}`,
      private: true,
      type: "module",
      scripts: { build: "vite build" },
      dependencies: Object.fromEntries(
        [
          "react",
          "react-dom",
          "clsx",
          "tailwind-merge",
          "tw-animate-css",
          "tailwindcss",
        ].map((dep) => [dep, exact(example.dependencies[dep])]),
      ),
      devDependencies: {
        "@types/react": exact(example.devDependencies["@types/react"]),
        "@types/react-dom": exact(example.devDependencies["@types/react-dom"]),
        typescript: exact(example.devDependencies.typescript),
        vite: exact(example.devDependencies.vite),
        "@vitejs/plugin-react": exact(
          example.devDependencies["@vitejs/plugin-react"],
        ),
        "@tailwindcss/vite": exact(example.dependencies["@tailwindcss/vite"]),
        shadcn: exact(pkg.devDependencies.shadcn),
      },
    });
    write("components.json", {
      $schema: "https://ui.shadcn.com/schema.json",
      style: "base-nova",
      rsc: false,
      tsx: true,
      tailwind: {
        config: "",
        css: "src/index.css",
        baseColor: "neutral",
        cssVariables: true,
      },
      iconLibrary: "lucide",
      aliases: {
        components: "@/components",
        ui: "@/components/ui",
        lib: "@/lib",
        hooks: "@/hooks",
        utils: "@/lib/utils",
      },
      registries: { "@pipecat": endpoint },
    });
    write("tsconfig.json", {
      compilerOptions: {
        target: "ES2023",
        lib: ["ES2023", "DOM"],
        module: "ESNext",
        moduleResolution: "Bundler",
        jsx: "react-jsx",
        types: ["vite/client"],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src"],
    });
    write(
      "vite.config.mjs",
      'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nimport tailwind from "@tailwindcss/vite";\nexport default defineConfig({ plugins: [react(), tailwind()], resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } } });\n',
    );
    write(
      "src/lib/utils.ts",
      'import { clsx, type ClassValue } from "clsx";\nimport { twMerge } from "tailwind-merge";\nexport function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }\n',
    );
    write(
      "src/index.css",
      '@import "tailwindcss";\n@import "tw-animate-css";\n@import "shadcn/tailwind.css";\n@custom-variant dark (&:is(.dark *));\n:root { --background: white; --foreground: black; }\n',
    );
    write(
      "index.html",
      '<html><head><title>Registry install verification</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
    );
    await run(
      "npm",
      ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
      dir,
    );
    await run(
      process.execPath,
      [
        cli,
        "init",
        "--preset",
        "nova",
        "--base",
        "base",
        "--template",
        "vite",
        "--yes",
        "--force",
        "--no-monorepo",
        "--no-reinstall",
        "--no-rtl",
        "--no-pointer",
      ],
      dir,
    );
    const initialized = JSON.parse(
      fs.readFileSync(path.join(dir, "components.json"), "utf8"),
    );
    assert.equal(
      initialized.style,
      "base-nova",
      "Scratch app must use the supported base-nova style",
    );
    initialized.registries = {
      ...initialized.registries,
      "@pipecat": endpoint,
    };
    write("components.json", initialized);
    const selected =
      name === "all"
        ? registry.items
        : registry.items.filter((item) => item.name === name);
    await run(
      process.execPath,
      [
        cli,
        "add",
        "--yes",
        "--overwrite",
        ...selected.map((item) => `@pipecat/${item.name}`),
      ],
      dir,
    );
    const imported = new Set();
    function collect(item) {
      if (imported.has(item.name)) return;
      imported.add(item.name);
      for (const dep of item.registryDependencies ?? [])
        if (dep.startsWith("@pipecat/"))
          collect(
            registry.items.find((item) => `@pipecat/${item.name}` === dep),
          );
    }
    selected.forEach(collect);
    const installed = registry.items.filter((item) => imported.has(item.name));
    const files = new Map(
      installed.flatMap((item) => item.files.map((file) => [file.path, file])),
    );
    const modules = [];
    for (const file of files.values()) {
      const target =
        file.target ??
        `${file.type === "registry:hook" ? "hooks" : "lib"}/${path.basename(file.path)}`;
      const location = path.join(dir, "src", target);
      assert(
        fs.existsSync(location),
        `${name}: missing installed target ${target}`,
      );
      modules.push(`@/${target.replace(/\.tsx?$/, "")}`);
    }
    write(
      "src/main.tsx",
      'import "./index.css";\n' +
        modules
          .map((mod, i) => `import * as m${i} from ${JSON.stringify(mod)};`)
          .join("\n") +
        `\nconsole.log([${modules.map((_, i) => `m${i}`).join(",")}]);\n`,
    );
    const css = fs.readFileSync(path.join(dir, "src/index.css"), "utf8");
    for (const item of installed) {
      for (const vars of Object.values(item.cssVars ?? {}))
        for (const key of Object.keys(vars))
          assert(
            css.includes(`--${key}:`),
            `${name}: missing merged CSS variable ${key}`,
          );
      for (const rule of Object.keys(item.css ?? {}))
        assert(css.includes(rule), `${name}: missing merged CSS rule ${rule}`);
      for (const dep of item.dependencies ?? []) {
        const split = dep.lastIndexOf("@");
        const packageName = dep.slice(0, split);
        const version = JSON.parse(
          fs.readFileSync(
            path.join(dir, "node_modules", packageName, "package.json"),
          ),
        ).version;
        if (packageName.startsWith("@pipecat-ai/"))
          assert.equal(
            version.split(".")[0],
            "1",
            `${name}: incompatible SDK major ${version}`,
          );
      }
    }
    await run(path.join(dir, "node_modules/.bin/tsc"), ["--noEmit"], dir);
    await run("npm", ["run", "build"], dir);
    console.log(`PASS: ${name} installs, merges CSS, typechecks and bundles.`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.rmSync(temporary, { recursive: true, force: true });
} finally {
  server.close();
}
