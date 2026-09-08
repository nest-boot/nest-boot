import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const v8Version =
  /^8\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-beta\.(?:0|[1-9]\d*))?$/;

export function getReleaseSpecifier(branch, manifests, tags = []) {
  if (branch === "main") return null;
  if (branch !== "beta") {
    throw new Error(`Unsupported release branch: ${branch}`);
  }

  for (const manifest of manifests) {
    if (manifest.private) continue;
    if (!v8Version.test(manifest.version)) {
      throw new Error(
        `${manifest.name}: beta releases must stay on v8; invalid baseline ${manifest.version}`,
      );
    }
    const staleTag = tags.find(
      (tag) =>
        tag.startsWith(`${manifest.name}@`) &&
        /^(?:9|[1-9]\d+)\./.test(tag.slice(manifest.name.length + 1)),
    );
    if (staleTag) {
      throw new Error(
        `${manifest.name}: v8 beta releases cannot use stale tag ${staleTag}`,
      );
    }
  }

  // An explicit specifier overrides conventional commits. In particular, a
  // breaking change on beta must not turn an 8.x baseline into 9.0.0-beta.0.
  return "prerelease";
}

if (import.meta.main) {
  const manifests = readdirSync("packages", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("packages", entry.name, "package.json"))
    .filter((path) => existsSync(path))
    .map((path) => JSON.parse(readFileSync(path, "utf8")));
  // Nx resolves current versions from tags. A stale v9 tag must not silently
  // override a corrected v8 manifest in a checkout that has cached old tags.
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
