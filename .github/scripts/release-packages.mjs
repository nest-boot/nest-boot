import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getReleaseSpecifier } from "./release-policy.mjs";

export function releasePackages(
  branch,
  {
    cwd = process.cwd(),
    exec = execFileSync,
    projects = [],
    dryRun = false,
  } = {},
) {
  if (branch !== "main" && branch !== "beta") {
    throw new Error(`Unsupported release branch: ${branch}`);
  }

  const run = (command, args, stdio = "pipe") =>
    exec(command, args, { cwd, encoding: "utf8", stdio });
  const readManifest = (root) => {
    const path = join(cwd, root, "package.json");
    if (!existsSync(path)) return;
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    if (!manifest.private && manifest.name && manifest.version) return manifest;
  };
  const roots = readdirSync(join(cwd, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join("packages", entry.name));
  const manifests = roots.map(readManifest).filter(Boolean);
  const publicNames = new Set(manifests.map(({ name }) => name));
  for (const project of projects) {
    if (!publicNames.has(project))
      throw new Error(`Unknown release project: ${project}`);
  }

  const isPublished = ({ name, version }) => {
    const spec = `${name}@${version}`;
    try {
      run("npm", ["view", spec, "version", "--json"]);
      return true;
    } catch (error) {
      let code;
      try {
        code = JSON.parse(error.stdout?.toString() || "{}").error?.code;
      } catch {
        // An unrecognized response is not evidence of an unpublished version.
      }
      if (code !== "E404") {
        throw new Error(`Unable to check npm publication for ${spec}`, {
          cause: error,
        });
      }
      return false;
    }
  };
  const prereleases =
    branch === "main"
      ? manifests.filter(({ version }) => version.includes("-"))
      : [];
  const graduate = prereleases.length > 0;
  if (graduate) {
    getReleaseSpecifier(branch, manifests, [], { graduate });
    // Check the whole promotion before Nx writes manifests, commits, or tags.
    // A retry after versioning uses stable manifests and skips this phase.
    for (const manifest of prereleases) {
      const version = manifest.version.split("-")[0];
      if (isPublished({ ...manifest, version })) {
        throw new Error(`${manifest.name}@${version} is already published`);
      }
    }
  }

  const releaseBase = run("git", [
    "log",
    "-1",
    "--format=%H",
    "--grep=^chore(release): publish$",
  ]).trim();
  if (!releaseBase)
    throw new Error("Unable to find the previous release commit");

  const changedFiles = run("git", [
    "diff",
    "--name-only",
    `${releaseBase}...HEAD`,
    "--",
    "packages",
  ])
    .trim()
    .split("\n")
    .filter(Boolean);
  const changedRoots = new Set(
    changedFiles.map((file) => file.split("/").slice(0, 2).join("/")),
  );
  const changedProjects = [
    ...new Set([
      ...projects,
      ...prereleases.map(({ name }) => name),
      ...[...changedRoots]
        .map(readManifest)
        .filter(Boolean)
        .map(({ name }) => name),
    ]),
  ].sort();

  if (changedProjects.length) {
    run(
      "node",
      [
        ".github/scripts/release.mjs",
        branch,
        changedProjects.join(","),
        ...(graduate ? ["--graduate"] : []),
        ...(dryRun ? ["--dry-run"] : []),
      ],
      "inherit",
    );
  }
  if (dryRun) return;

  // A release commit can exist even when npm publication failed. Always scan
  // the current manifests, including on a retry with no changed packages.
  const versionedManifests = roots.map(readManifest).filter(Boolean);
  for (const manifest of versionedManifests) {
    if (branch === "main" && manifest.version.includes("-")) {
      throw new Error(
        `Cannot publish prerelease ${manifest.name}@${manifest.version} to latest`,
      );
    }
  }
  const missingProjects = versionedManifests
    .filter((manifest) => !isPublished(manifest))
    .map(({ name }) => name);

  if (missingProjects.length) {
    run(
      "pnpm",
      [
        "exec",
        "nx",
        "release",
        "publish",
        "--projects",
        missingProjects.join(","),
        "--yes",
        "--tag",
        branch === "beta" ? "beta" : "latest",
      ],
      "inherit",
    );
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const branch = args.find((arg) => !arg.startsWith("--"));
  for (const arg of args) {
    if (arg !== branch && arg !== "--dry-run")
      throw new Error(`Unknown release argument: ${arg}`);
  }
  releasePackages(branch, {
    dryRun: args.includes("--dry-run"),
    projects: (process.env.RELEASE_PROJECTS || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  });
}
