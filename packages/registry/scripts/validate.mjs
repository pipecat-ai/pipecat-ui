import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registryItemSchema, registrySchema } from "shadcn/schema";
import ts from "typescript";
import {
  requiredPeers,
  storyExceptions,
  styleDependencies,
  unpublishedSources,
} from "./policy.mjs";

export const registryRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceRoot = path.resolve(registryRoot, "../..");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export function importsOf(source, filename) {
  const imports = [];
  const ast = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push({ specifier: node.moduleSpecifier.text, dynamic: false });
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push({ specifier: node.arguments[0].text, dynamic: true });
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      imports.push({ specifier: node.argument.literal.text, dynamic: false });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return imports;
}

export function parseDependency(value) {
  const match =
    /^(@[^/]+\/[^@]+|[^@/]+)@([~^]?\d+\.\d+\.\d+(?:-[\w.-]+)?)$/.exec(value);
  assert(
    match,
    `Dependency must use an explicit tested version or compatible range: ${value}`,
  );
  return { name: match[1], range: match[2] };
}

function installedPath(file) {
  if (file.target) return file.target;
  const dir = { "registry:hook": "hooks", "registry:lib": "lib" }[file.type];
  assert(dir, `Explicit target required for ${file.path}`);
  return `${dir}/${path.basename(file.path)}`;
}

function modulePath(file) {
  return `@/${installedPath(file).replace(/\.[^.]+$/, "")}`;
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".stories.")
      ? [full]
      : [];
  });
}

export function validateRegistry(
  registry = readJson(path.join(registryRoot, "registry.json")),
) {
  registrySchema.parse(registry);
  const items = new Map(registry.items.map((item) => [item.name, item]));
  assert.equal(
    items.size,
    registry.items.length,
    "Duplicate registry item names",
  );
  const packages = readJson(path.join(registryRoot, "package.json"));
  const testedVersions = {
    ...packages.dependencies,
    ...packages.devDependencies,
  };
  const shipped = new Set();
  const targets = new Map();

  // A dependency's files are installed too. This also detects cycles and unknown items.
  function closure(item, ancestors = []) {
    assert(
      !ancestors.includes(item.name),
      `Registry dependency cycle: ${[...ancestors, item.name].join(" -> ")}`,
    );
    return [
      item,
      ...(item.registryDependencies ?? [])
        .filter((dep) => dep.startsWith("@pipecat/"))
        .flatMap((dep) => {
          const dependency = items.get(dep.slice("@pipecat/".length));
          assert(
            dependency,
            `${item.name}: unknown registry dependency ${dep}`,
          );
          return closure(dependency, [...ancestors, item.name]);
        }),
    ];
  }

  for (const item of registry.items) {
    if (item.meta?.deprecated) {
      assert(
        typeof item.meta.deprecated.reason === "string" &&
          item.meta.deprecated.reason.trim(),
        `${item.name}: deprecation requires a reason`,
      );
      if (item.meta.deprecated.replacement) {
        assert(
          item.meta.deprecated.replacement !== `@pipecat/${item.name}` &&
            items.has(
              item.meta.deprecated.replacement.replace(/^@pipecat\//, ""),
            ),
          `${item.name}: invalid deprecation replacement`,
        );
      }
    }
    const available = closure(item);
    const modules = new Set(
      available.flatMap((dep) => dep.files.map(modulePath)),
    );
    const primitives = new Set(
      available
        .flatMap((dep) => dep.registryDependencies ?? [])
        .filter((dep) => !dep.startsWith("@pipecat/")),
    );
    for (const primitive of primitives) {
      assert(
        /^[a-z][a-z0-9-]*$/.test(primitive),
        `${item.name}: unsupported registry dependency ${primitive}`,
      );
      for (const host of ["docs", "storybook"]) {
        const hostDir = host === "docs" ? "" : "src/";
        assert(
          fs.existsSync(
            path.join(
              workspaceRoot,
              `apps/${host}/${hostDir}components/ui/${primitive}.tsx`,
            ),
          ),
          `${item.name}: ${primitive} is not present in the ${host} test host`,
        );
      }
    }

    const required = new Set(Object.keys(styleDependencies[item.name] ?? {}));
    for (const file of item.files) {
      assert(
        file.path.startsWith("src/") && !file.path.split("/").includes(".."),
        `${item.name}: unsafe source path ${file.path}`,
      );
      assert(
        !file.path.includes(".stories."),
        `${item.name}: stories must not ship`,
      );
      const target = installedPath(file);
      assert(
        !path.isAbsolute(target) && !target.split("/").includes(".."),
        `${item.name}: unsafe target ${target}`,
      );
      assert(
        !targets.has(target) || targets.get(target) === file.path,
        `${item.name}: conflicting target ${target}`,
      );
      targets.set(target, file.path);
      shipped.add(file.path);
      const source = fs.readFileSync(
        path.join(registryRoot, file.path),
        "utf8",
      );
      for (const { specifier } of importsOf(source, file.path)) {
        if (
          specifier === "react" ||
          specifier.startsWith("react/") ||
          specifier === "react-dom" ||
          specifier.startsWith("react-dom/") ||
          specifier === "@/lib/utils"
        )
          continue;
        if (specifier.startsWith("@/components/ui/")) {
          assert(
            primitives.has(specifier.slice("@/components/ui/".length)),
            `${item.name}: undeclared primitive ${specifier}`,
          );
        } else if (specifier.startsWith("@/")) {
          assert(
            modules.has(specifier),
            `${item.name}: unshipped import ${specifier}`,
          );
        } else if (specifier.startsWith(".")) {
          const resolved = path.posix.normalize(
            path.posix.join(path.posix.dirname(modulePath(file)), specifier),
          );
          assert(
            modules.has(resolved),
            `${item.name}: unshipped relative import ${specifier}`,
          );
        } else {
          const name = specifier.startsWith("@")
            ? specifier.split("/").slice(0, 2).join("/")
            : specifier.split("/")[0];
          required.add(name);
          for (const peer of requiredPeers[name] ?? []) required.add(peer);
        }
      }
    }
    const declared = new Set();
    for (const value of item.dependencies ?? []) {
      const { name, range } = parseDependency(value);
      assert(!declared.has(name), `${item.name}: duplicate dependency ${name}`);
      assert.equal(
        range,
        testedVersions[name],
        `${item.name}: ${name} must match the registry workspace's tested range`,
      );
      declared.add(name);
    }
    assert.deepEqual(
      [...declared].sort(),
      [...required].sort(),
      `${item.name}: dependencies must cover direct imports, required peers and documented CSS dependencies only`,
    );

    const section =
      item.type === "registry:hook"
        ? "hooks"
        : item.type === "registry:block"
          ? "blocks"
          : item.name.startsWith("audio-visualizer-")
            ? "visualizers"
            : "components";
    assert(
      fs.existsSync(
        path.join(
          workspaceRoot,
          `apps/docs/content/docs/${section}/${item.name}.mdx`,
        ),
      ),
      `${item.name}: missing docs`,
    );
    assert(
      fs.existsSync(path.join(registryRoot, `tests/${item.name}.test.tsx`)),
      `${item.name}: missing tests`,
    );
    assert(
      storyExceptions[item.name] ||
        item.files.some((file) =>
          fs.existsSync(
            path.join(
              registryRoot,
              file.path.replace(/\.tsx?$/, ".stories.tsx"),
            ),
          ),
        ),
      `${item.name}: missing story`,
    );
  }
  for (const full of sourceFiles(path.join(registryRoot, "src"))) {
    const relative = path
      .relative(registryRoot, full)
      .split(path.sep)
      .join("/");
    assert(
      shipped.has(relative) ||
        Object.keys(unpublishedSources).some((prefix) =>
          relative.startsWith(prefix),
        ),
      `Source is neither shipped nor explicitly excluded: ${relative}`,
    );
  }
  return registry;
}

export function validateArtifacts(output, registry) {
  assert.deepEqual(
    fs.readdirSync(output).sort(),
    [
      "registry.json",
      ...registry.items.map((item) => `${item.name}.json`),
    ].sort(),
    "Built registry contains missing or stale items",
  );
  assert.deepEqual(
    registrySchema.parse(readJson(path.join(output, "registry.json"))),
    registrySchema.parse(registry),
    "Built registry index does not match the manifest",
  );
  for (const item of registry.items) {
    const built = readJson(path.join(output, `${item.name}.json`));
    registryItemSchema.parse(built);
    const expected = registryItemSchema.parse({
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      ...item,
      files: item.files.map((file) => ({
        ...file,
        content: fs.readFileSync(path.join(registryRoot, file.path), "utf8"),
      })),
    });
    assert.deepEqual(
      registryItemSchema.parse(built),
      expected,
      `${item.name}: artifact does not match source and manifest`,
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const registry = validateRegistry();
  if (process.argv[2])
    validateArtifacts(path.resolve(process.argv[2]), registry);
  console.log(
    `Validated ${registry.items.length} registry items, dependencies, source coverage, docs and tests.`,
  );
}
