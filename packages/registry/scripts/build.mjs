import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import {
  registryRoot,
  validateArtifacts,
  validateRegistry,
} from "./validate.mjs";

const registry = validateRegistry();
const publicDir = path.join(registryRoot, "public");
mkdirSync(publicDir, { recursive: true });
const staging = mkdtempSync(path.join(publicDir, ".registry-build-"));
try {
  execFileSync("pnpm", ["exec", "shadcn", "build", "--output", staging], {
    cwd: registryRoot,
    stdio: "inherit",
  });
  validateArtifacts(staging, registry);
  // Replacing the directory prevents removed items surviving the next docs deploy.
  rmSync(path.join(publicDir, "r"), { recursive: true, force: true });
  renameSync(staging, path.join(publicDir, "r"));
} finally {
  rmSync(staging, { recursive: true, force: true });
}
