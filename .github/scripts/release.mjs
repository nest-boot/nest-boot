import { ReleaseClient } from "nx/release";

import { getReleaseConfig } from "./release-policy.mjs";

const [branch, projects, ...flags] = process.argv.slice(2);
if (!projects) throw new Error("At least one release project is required");

const release = new ReleaseClient(getReleaseConfig(branch));
await release.release({
  projects: projects.split(","),
  specifier: branch === "beta" ? "prerelease" : undefined,
  preid: branch === "beta" ? "beta" : undefined,
  skipPublish: true,
  dryRun: flags.includes("--dry-run"),
});
