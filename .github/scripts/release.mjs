import { ReleaseClient } from "nx/release";
import { execFileSync } from "node:child_process";

import {
  getReleaseConfig,
  getReleaseSpecifier,
  readReleaseManifests,
} from "./release-policy.mjs";

const [branch, projects, ...flags] = process.argv.slice(2);
if (!projects) throw new Error("At least one release project is required");
for (const flag of flags) {
  if (flag !== "--graduate" && flag !== "--dry-run")
    throw new Error(`Unknown release flag: ${flag}`);
}
const graduate = flags.includes("--graduate");
const manifests = readReleaseManifests();
const tags = execFileSync(
  "git",
  ["tag", "--merged", "HEAD", "--list", "@nest-boot/*"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");
const specifier = getReleaseSpecifier(branch, manifests, tags, { graduate });

const release = new ReleaseClient(getReleaseConfig(branch, { graduate }));
await release.release({
  projects: projects.split(","),
  specifier: specifier ?? undefined,
  preid: branch === "beta" ? "beta" : undefined,
  skipPublish: true,
  dryRun: flags.includes("--dry-run"),
});
