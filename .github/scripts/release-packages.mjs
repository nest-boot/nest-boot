import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function releasePackages(
  branch,
  { cwd = process.cwd(), exec = execFileSync, projects = [] } = {},
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
  const publicNames = new Set(
    roots
      .map(readManifest)
      .filter(Boolean)
      .map(({ name }) => name),
  );
  for (const project of projects) {
    if (!publicNames.has(project))
      throw new Error(`Unknown release project: ${project}`);
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
      ...[...changedRoots]
        .map(readManifest)
        .filter(Boolean)
        .map(({ name }) => name),
    ]),
  ].sort();

  if (changedProjects.length) {
    run(
      "node",
      [".github/scripts/release.mjs", branch, changedProjects.join(",")],
      "inherit",
    );
  }

  // A release commit can exist even when npm publication failed. Always scan
  // the current manifests, including on a retry with no changed packages.
  const missingProjects = [];
  for (const root of roots) {
    const manifest = readManifest(root);
    if (!manifest) continue;
    const spec = `${manifest.name}@${manifest.version}`;
    try {
      run("npm", ["view", spec, "version", "--json"]);
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
      missingProjects.push(manifest.name);
    }
  }

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
  releasePackages(process.argv[2], {
    projects: (process.env.RELEASE_PROJECTS || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  });
}
