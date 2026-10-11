import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Changesets calculates versions and publishes tarballs. Reconcile only the
// original artifact plan: a fresh npm plan omits successfully uploaded versions.
export function recoverReleaseMetadata(
  plan,
  {
    cwd = process.cwd(),
    repository = process.env.GITHUB_REPOSITORY,
    sha = process.env.GITHUB_SHA,
    run = (command, args) =>
      execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" }),
  } = {},
) {
  if (!repository || !sha || plan.version !== 1 || !Array.isArray(plan.plan)) {
    throw new Error(
      "Release recovery requires the original plan, repository and workflow commit.",
    );
  }
  const packages = new Map(
    readdirSync(join(cwd, "packages")).map((directory) => {
      const path = join(cwd, "packages", directory);
      const manifest = JSON.parse(
        readFileSync(join(path, "package.json"), "utf8"),
      );
      return [manifest.name, { path, manifest }];
    }),
  );
  const temporary = mkdtempSync(join(tmpdir(), "release-notes-"));
  try {
    for (const release of plan.plan.flat()) {
      if (release.kind !== "publish") continue;
      const pkg = packages.get(release.name);
      if (
        !pkg ||
        pkg.manifest.private ||
        pkg.manifest.version !== release.version
      ) {
        throw new Error(
          `Release plan does not match this checkout: ${release.name}@${release.version}`,
        );
      }
      const tag = `${release.name}@${release.version}`;
      let published;
      try {
        published = JSON.parse(run("npm", ["view", tag, "version", "--json"]));
      } catch (error) {
        if (error.stdout && JSON.parse(error.stdout).error?.code === "E404")
          continue;
        throw error;
      }
      if (published !== release.version)
        throw new Error(`Unexpected registry version for ${tag}`);
      try {
        run("gh", [
          "api",
          `repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
        ]);
        continue;
      } catch (error) {
        if (!String(error.stderr).includes("(HTTP 404)")) throw error;
      }
      const changelog = readFileSync(join(pkg.path, "CHANGELOG.md"), "utf8");
      const entry = changelog
        .split(/(?=^## )/m)
        .find(
          (section) =>
            section.split("\n")[0].trim() === `## ${release.version}`,
        );
      if (!entry) throw new Error(`Missing changelog entry for ${tag}`);
      const notes = join(temporary, "notes.md");
      writeFileSync(notes, entry.split("\n").slice(1).join("\n").trim());
      // --target creates a missing tag at the original workflow SHA; an existing
      // tag is reused and never moved. Existing releases are never overwritten.
      run("gh", [
        "release",
        "create",
        tag,
        "--repo",
        repository,
        "--target",
        sha,
        "--title",
        tag,
        "--notes-file",
        notes,
        ...(release.version.includes("-") ? ["--prerelease"] : []),
      ]);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  recoverReleaseMetadata(JSON.parse(readFileSync(process.argv[2], "utf8")));
}
