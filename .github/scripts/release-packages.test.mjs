import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { releasePackages } from "./release-packages.mjs";

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "release-packages-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd, stdio: "pipe" });
  const manifest = (name, extra = {}) => {
    const root = join(cwd, "packages", name);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: `@nest-boot/${name}`,
        version: "8.0.0-beta.0",
        ...extra,
      }),
    );
  };
  const commit = (message) => {
    git("add", ".");
    git("commit", "-m", message);
  };
  git("init");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release@example.com");
  manifest("example");
  commit("chore(release): publish");
  return { cwd, manifest, commit };
}

function registryError(code) {
  return Object.assign(new Error(code), {
    stdout: JSON.stringify({ error: { code } }),
  });
}

test("a failed npm publish can be retried without another version bump", (t) => {
  const { cwd, manifest, commit } = fixture(t);
  manifest("example", { description: "Changed package" });
  commit("fix(example): correct behavior");
  let versionCalls = 0;
  let publishCalls = 0;
  const checked = [];
  const exec = (command, args, options) => {
    if (command === "git") return execFileSync(command, args, options);
    if (command === "node") {
      versionCalls++;
      assert.deepEqual(args, [
        ".github/scripts/release.mjs",
        "beta",
        "@nest-boot/example",
      ]);
      manifest("example", { version: "8.0.0-beta.1" });
      commit("chore(release): publish");
      return "";
    }
    if (command === "npm") {
      checked.push(args[1]);
      throw registryError("E404");
    }
    assert.equal(command, "pnpm");
    assert.deepEqual(args, [
      "exec",
      "nx",
      "release",
      "publish",
      "--projects",
      "@nest-boot/example",
      "--yes",
      "--tag",
      "beta",
    ]);
    if (++publishCalls === 1) throw new Error("Publish denied");
    return "";
  };
  assert.throws(() => releasePackages("beta", { cwd, exec }), /Publish denied/);
  releasePackages("beta", { cwd, exec });
  assert.equal(versionCalls, 1);
  assert.equal(publishCalls, 2);
  assert.deepEqual(checked, [
    "@nest-boot/example@8.0.0-beta.1",
    "@nest-boot/example@8.0.0-beta.1",
  ]);
});

test("a fully published release does not bump versions or publish again", (t) => {
  const { cwd } = fixture(t);
  releasePackages("beta", {
    cwd,
    exec(command, args, options) {
      if (command === "git") return execFileSync(command, args, options);
      assert.equal(command, "npm");
      return '"8.0.0-beta.0"';
    },
  });
});

for (const code of ["E401", "E403", "E500", "ETIMEDOUT"]) {
  test(`registry ${code} stops the release instead of treating packages as missing`, (t) => {
    const { cwd } = fixture(t);
    assert.throws(
      () =>
        releasePackages("beta", {
          cwd,
          exec(command, args, options) {
            if (command === "git") return execFileSync(command, args, options);
            assert.equal(command, "npm");
            throw registryError(code);
          },
        }),
      (error) => {
        assert.match(error.message, /Unable to check npm publication/);
        assert.equal(error.cause.message, code);
        return true;
      },
    );
  });
}

test("main recovers with the latest tag and excludes private or unversioned packages", (t) => {
  const { cwd, manifest, commit } = fixture(t);
  manifest("example", { version: "7.0.0" });
  manifest("private", { private: true });
  manifest("unversioned", { version: undefined });
  mkdirSync(join(cwd, "packages", "without-manifest"));
  commit("chore(release): publish");
  const calls = [];
  releasePackages("main", {
    cwd,
    exec(command, args, options) {
      if (command === "git") return execFileSync(command, args, options);
      calls.push([command, args]);
      if (command === "npm") throw registryError("E404");
      return "";
    },
  });
  assert.deepEqual(calls, [
    ["npm", ["view", "@nest-boot/example@7.0.0", "version", "--json"]],
    [
      "pnpm",
      [
        "exec",
        "nx",
        "release",
        "publish",
        "--projects",
        "@nest-boot/example",
        "--yes",
        "--tag",
        "latest",
      ],
    ],
  ]);
});

test("an unsupported branch cannot invoke release commands", () => {
  assert.throws(
    () =>
      releasePackages("feature", {
        exec() {
          assert.fail("Unexpected release command");
        },
      }),
    /Unsupported release branch/,
  );
});

test("an explicit package can validate new trusted publishing without a source change", (t) => {
  const { cwd, manifest, commit } = fixture(t);
  const calls = [];
  releasePackages("beta", {
    cwd,
    projects: ["@nest-boot/example", "@nest-boot/example"],
    exec(command, args, options) {
      if (command === "git") return execFileSync(command, args, options);
      calls.push([command, args]);
      if (command === "node") {
        manifest("example", { version: "8.0.0-beta.1" });
        commit("chore(release): publish");
      }
      if (command === "npm") throw registryError("E404");
      return "";
    },
  });
  assert.deepEqual(calls[0], [
    "node",
    [".github/scripts/release.mjs", "beta", "@nest-boot/example"],
  ]);
  assert.deepEqual(calls[1], [
    "npm",
    ["view", "@nest-boot/example@8.0.0-beta.1", "version", "--json"],
  ]);
  assert.equal(calls[2][0], "pnpm");
});

test("unknown explicit packages are rejected before release commands run", (t) => {
  const { cwd } = fixture(t);
  assert.throws(
    () =>
      releasePackages("beta", {
        cwd,
        projects: ["@nest-boot/missing"],
        exec() {
          assert.fail("Unexpected release command");
        },
      }),
    /Unknown release project/,
  );
});

test("main graduates every prerelease even with no changes since the beta release", (t) => {
  const { cwd, manifest, commit } = fixture(t);
  manifest("unchanged", { version: "8.0.5-beta.3" });
  manifest("private", { private: true });
  commit("chore(release): publish");
  const calls = [];
  releasePackages("main", {
    cwd,
    exec(command, args, options) {
      if (command === "git") return execFileSync(command, args, options);
      calls.push([command, args]);
      if (command === "node") {
        manifest("example", { version: "8.0.0" });
        manifest("unchanged", { version: "8.0.5" });
        commit("chore(release): publish");
      }
      if (command === "npm") throw registryError("E404");
      return "";
    },
  });
  assert.ok(
    calls.some(
      ([command, args]) =>
        command === "node" &&
        args.join(" ") ===
          ".github/scripts/release.mjs main @nest-boot/example,@nest-boot/unchanged --graduate",
    ),
  );
  assert.equal(calls.at(-1)[0], "pnpm");
  assert.equal(calls.at(-1)[1].at(-1), "latest");
});

for (const stableProject of ["changed", "explicit", "dependent"]) {
  test(`graduation rejects a stable ${stableProject} before invoking release commands`, (t) => {
    const { cwd, manifest, commit } = fixture(t);
    manifest("stable", {
      version: "8.0.5",
      ...(stableProject === "dependent"
        ? { dependencies: { "@nest-boot/example": "^8.0.0-beta.0" } }
        : {}),
    });
    commit("chore(release): publish");
    if (stableProject === "changed") {
      manifest("stable", { version: "8.0.5", description: "New feature" });
      commit("feat(stable): add a feature");
    }
    assert.throws(
      () =>
        releasePackages("main", {
          cwd,
          projects: stableProject === "explicit" ? ["@nest-boot/stable"] : [],
          exec() {
            assert.fail("Mixed graduation must stop before release commands");
          },
        }),
      /graduation requires all public packages to be prereleases/,
    );
  });
}

test("an occupied stable target stops graduation before any version or publication writes", (t) => {
  const { cwd } = fixture(t);
  assert.throws(
    () =>
      releasePackages("main", {
        cwd,
        exec(command, args, options) {
          if (command === "git") return execFileSync(command, args, options);
          assert.equal(command, "npm");
          assert.equal(args[1], "@nest-boot/example@8.0.0");
          return '"8.0.0"';
        },
      }),
    /already published/,
  );
});

test("a graduation dry run never publishes or requires manifests to be mutated", (t) => {
  const { cwd } = fixture(t);
  let versionCalls = 0;
  releasePackages("main", {
    cwd,
    dryRun: true,
    exec(command, args, options) {
      if (command === "git") return execFileSync(command, args, options);
      if (command === "npm") throw registryError("E404");
      assert.equal(command, "node");
      assert.ok(args.includes("--graduate"));
      assert.ok(args.includes("--dry-run"));
      versionCalls++;
      return "";
    },
  });
  assert.equal(versionCalls, 1);
});

test("main cannot publish a prerelease left behind by versioning", (t) => {
  const { cwd } = fixture(t);
  assert.throws(
    () =>
      releasePackages("main", {
        cwd,
        exec(command, args, options) {
          if (command === "git") return execFileSync(command, args, options);
          if (command === "npm") throw registryError("E404");
          assert.equal(command, "node");
          return "";
        },
      }),
    /Cannot publish prerelease.*latest/,
  );
});

test("a failed stable publish retries without another graduation or version bump", (t) => {
  const { cwd, manifest, commit } = fixture(t);
  let versionCalls = 0;
  let publishCalls = 0;
  const exec = (command, args, options) => {
    if (command === "git") return execFileSync(command, args, options);
    if (command === "npm") throw registryError("E404");
    if (command === "node") {
      versionCalls++;
      assert.ok(args.includes("--graduate"));
      manifest("example", { version: "8.0.0" });
      commit("chore(release): publish");
      return "";
    }
    assert.equal(command, "pnpm");
    assert.equal(args.at(-1), "latest");
    if (++publishCalls === 1) throw new Error("Publish denied");
    return "";
  };
  assert.throws(() => releasePackages("main", { cwd, exec }), /Publish denied/);
  releasePackages("main", { cwd, exec });
  assert.equal(versionCalls, 1);
  assert.equal(publishCalls, 2);
});

test("registry authorization failure stops graduation before versioning", (t) => {
  const { cwd } = fixture(t);
  assert.throws(
    () =>
      releasePackages("main", {
        cwd,
        exec(command, args) {
          assert.equal(command, "npm");
          assert.equal(args[1], "@nest-boot/example@8.0.0");
          throw registryError("E403");
        },
      }),
    /Unable to check npm publication/,
  );
});
