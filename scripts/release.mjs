import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const unknownArguments = process.argv.slice(2).filter((argument) => {
  return argument !== "--dry-run";
});

if (unknownArguments.length > 0) {
  throw new Error(`Unknown release arguments: ${unknownArguments.join(", ")}`);
}

const packages = readdirSync("packages", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const manifestPath = join("packages", entry.name, "package.json");

    if (!existsSync(manifestPath)) {
      return [];
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

    if (manifest.private || !manifest.name || !manifest.version) {
      return [];
    }

    return [{ name: manifest.name, version: manifest.version }];
  })
  .sort((left, right) => left.name.localeCompare(right.name));

const firstReleases = [];
const existingReleases = [];

for (const manifest of packages) {
  const tags = execFileSync("git", ["tag", "--list", `${manifest.name}@*`], {
    encoding: "utf8",
  }).trim();

  (tags ? existingReleases : firstReleases).push(manifest);
}

function runNxRelease(arguments_) {
  execFileSync("pnpm", ["exec", "nx", "release", ...arguments_], {
    stdio: "inherit",
  });
}

const temporaryTags = [];

try {
  for (const manifest of firstReleases) {
    console.log(
      `Preparing first release ${manifest.name}@${manifest.version}${dryRun ? " (dry run)" : ""}`,
    );

    runNxRelease([
      manifest.version,
      "--projects",
      manifest.name,
      "--first-release",
      ...(dryRun ? ["--dry-run", "--skip-publish"] : ["--yes"]),
    ]);
  }

  if (dryRun) {
    for (const manifest of firstReleases) {
      const tag = `${manifest.name}@${manifest.version}`;
      execFileSync("git", ["tag", tag, "HEAD"]);
      temporaryTags.push(tag);
    }
  }

  if (existingReleases.length > 0) {
    console.log(
      `Preparing conventional releases for ${existingReleases.length} existing packages${dryRun ? " (dry run)" : ""}`,
    );

    runNxRelease([
      "--projects",
      existingReleases.map(({ name }) => name).join(","),
      ...(dryRun ? ["--dry-run", "--skip-publish"] : ["--yes"]),
    ]);
  }
} finally {
  for (const tag of temporaryTags) {
    execFileSync("git", ["tag", "--delete", tag], { stdio: "ignore" });
  }
}
