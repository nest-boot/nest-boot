import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const v8Version =
  /^8\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta\.(?:0|[1-9]\d*))?$/;

export function getReleaseConfig(branch, { graduate = false } = {}) {
  if (branch !== "main" && branch !== "beta")
    throw new Error(`Unsupported release branch: ${branch}`);
  if (graduate && branch !== "main")
    throw new Error("Graduation requires main");
  if (branch === "main" && !graduate) return {};
  // Conventional commits force Nx's git-tag resolver. Both beta increments and
  // graduation must instead start from the validated v8 manifest versions.
  return {
    version: {
      conventionalCommits: false,
      // A ^8.x-beta range also satisfies 8.x stable, but promotion should remove
      // the prerelease dependency ranges rather than preserve them.
      ...(graduate ? { preserveMatchingDependencyRanges: false } : {}),
    },
  };
}

export function getReleaseSpecifier(
  branch,
  manifests,
  tags = [],
  { graduate = false } = {},
) {
  getReleaseConfig(branch, { graduate });
  if (branch === "main" && !graduate) return null;

  for (const manifest of manifests) {
    if (manifest.private) continue;
    if (!v8Version.test(manifest.version)) {
      throw new Error(
        `${manifest.name}: beta releases and graduation must stay on v8; invalid baseline ${manifest.version}`,
      );
    }
    const staleTag = tags.find(
      (tag) =>
        tag.startsWith(`${manifest.name}@`) &&
        /^(?:9|[1-9]\d+)\./.test(tag.slice(manifest.name.length + 1)),
    );
    if (staleTag) {
      throw new Error(
        `${manifest.name}: v8 releases cannot use stale tag ${staleTag}`,
      );
    }
  }

  // An explicit specifier overrides conventional commits. In particular, a
  // breaking change on beta must not turn an 8.x baseline into 9.0.0-beta.0.
  // An explicit patch graduates 8.x.y-beta.n to 8.x.y. Without it, Nx's
  // conventional-commit resolver deliberately continues prerelease versions.
  return graduate ? "patch" : "prerelease";
}

export function readReleaseManifests(cwd = process.cwd()) {
  return readdirSync(join(cwd, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(cwd, "packages", entry.name, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, "utf8")));
}

if (import.meta.main) {
  const manifests = readReleaseManifests();
  // Keep stale v9 release tags out of the v8 history as well as validating
  // the manifest versions used by Nx's disk resolver.
  const tags = execFileSync(
    "git",
    ["tag", "--merged", "HEAD", "--list", "@nest-boot/*"],
    {
      encoding: "utf8",
    },
  )
    .trim()
    .split("\n");
  const specifier = getReleaseSpecifier(process.argv[2], manifests, tags);
  if (specifier) process.stdout.write(specifier);
}
