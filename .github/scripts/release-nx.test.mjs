import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("real Nx graduates legacy-tagged and untagged packages, then resumes conventional releases", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "release-nx-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const repository = fileURLToPath(new URL("../../", import.meta.url));
  const write = (path, value) => {
    const absolute = join(cwd, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(
      absolute,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  };
  const read = (name) =>
    JSON.parse(
      readFileSync(join(cwd, `packages/${name}/package.json`), "utf8"),
    );
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe" });
  const commit = (message) => {
    git("add", ".");
    git("commit", "-m", message);
  };
  write(".gitignore", "node_modules\n.nx\n");
  write("package.json", {
    name: "release-fixture",
    private: true,
    packageManager: "pnpm@10.30.3",
    workspaces: ["packages/*"],
  });
  write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  write(
    "pnpm-lock.yaml",
    "lockfileVersion: '9.0'\nimporters:\n  .: {}\npackages: {}\nsnapshots: {}\n",
  );
  write("nx.json", {
    release: {
      projects: ["packages/*"],
      projectsRelationship: "independent",
      version: {
        conventionalCommits: true,
        applyPreidToDependents: true,
        fallbackCurrentVersionResolver: "disk",
        versionActionsOptions: { skipLockFileUpdate: true },
      },
      git: { commit: false, tag: false, push: false },
      changelog: { projectChangelogs: false, workspaceChangelog: false },
    },
  });
  symlinkSync(
    join(repository, "node_modules"),
    join(cwd, "node_modules"),
    "dir",
  );
  git("init");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release@example.com");
  const manifest = (name, version, dependencies = {}) =>
    write(`packages/${name}/package.json`, {
      name: `@nest-boot/${name}`,
      version,
      dependencies,
    });
  manifest("database", "6.17.1");
  manifest("auth", "8.0.2");
  commit("chore(release): publish");
  git("tag", "@nest-boot/database@6.17.1");
  git("tag", "@nest-boot/auth@8.0.2");
  manifest("database", "8.0.6-beta.0");
  manifest("queue", "8.0.8-beta.0");
  manifest("auth", "8.0.11-beta.0", {
    "@nest-boot/database": "^8.0.6-beta.0",
    "@nest-boot/queue": "workspace:^",
  });
  commit("feat!: prepare v8");
  const release = (branch, projects, ...flags) =>
    execFileSync(
      process.execPath,
      [
        join(repository, ".github/scripts/release.mjs"),
        branch,
        projects,
        ...flags,
      ],
      {
        cwd,
        encoding: "utf8",
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          ...process.env,
          NX_DAEMON: "false",
          NX_WORKSPACE_ROOT_PATH: cwd,
        },
      },
    );
  const projects = "@nest-boot/auth,@nest-boot/database,@nest-boot/queue";
  release("main", projects, "--graduate", "--dry-run");
  assert.equal(git("status", "--porcelain").toString(), "");
  assert.equal(read("database").version, "8.0.6-beta.0");

  release("main", projects, "--graduate");
  assert.equal(read("database").version, "8.0.6");
  assert.equal(read("queue").version, "8.0.8");
  assert.equal(read("auth").version, "8.0.11");
  assert.equal(read("auth").dependencies["@nest-boot/database"], "^8.0.6");
  assert.equal(read("auth").dependencies["@nest-boot/queue"], "workspace:^");
  commit("chore(release): publish");
  for (const name of ["auth", "database", "queue"]) {
    git("tag", `@nest-boot/${name}@${read(name).version}`);
  }
  write("packages/database/index.js", "export const fixed = true;\n");
  commit("fix: correct database behavior");
  release("main", "@nest-boot/database");
  assert.equal(read("database").version, "8.0.7");
  assert.equal(read("auth").version, "8.0.12");
});
