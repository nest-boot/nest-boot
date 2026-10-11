import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { recoverReleaseMetadata } from "./release-metadata.mjs";

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "release-metadata-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const version = "1.1.0-beta.0";
  const plan = {
    version: 1,
    plan: [
      ["a", "b"].map((name) => ({
        kind: "publish",
        name: `@fixture/${name}`,
        version,
      })),
    ],
  };
  for (const name of ["a", "b"]) {
    const directory = join(cwd, "packages", name);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ name: `@fixture/${name}`, version }),
    );
    writeFileSync(
      join(directory, "CHANGELOG.md"),
      `# @fixture/${name}\n\n## ${version}\n\nCurrent release.\n\n## 1.0.0\n\nPrevious release.\n`,
    );
  }
  return { cwd, version, plan, repository: "owner/repo", sha: "a".repeat(40) };
}

function registryError(code) {
  return Object.assign(new Error(code), {
    stdout: JSON.stringify({ error: { code } }),
  });
}

function githubError(status) {
  return Object.assign(new Error(`GitHub ${status}`), {
    stderr: `gh: request failed (HTTP ${status})`,
  });
}

test("replaying the original plan repairs partial metadata without recreating existing releases", (t) => {
  const f = fixture(t);
  const uploaded = new Set([`@fixture/a@${f.version}`]);
  const releases = new Set();
  const created = [];
  const run = (command, args) => {
    if (command === "npm") {
      if (!uploaded.has(args[1])) throw registryError("E404");
      return JSON.stringify(f.version);
    }
    if (args[0] === "api") {
      const tag = decodeURIComponent(args[1].split("/tags/")[1]);
      if (!releases.has(tag)) throw githubError(404);
      return "{}";
    }
    assert.deepEqual(args.slice(0, 2), ["release", "create"]);
    const tag = args[2];
    assert.equal(args[args.indexOf("--target") + 1], f.sha);
    assert.equal(args[args.indexOf("--repo") + 1], f.repository);
    assert.ok(args.includes("--prerelease"));
    const notes = readFileSync(args[args.indexOf("--notes-file") + 1], "utf8");
    assert.equal(notes, "Current release.");
    created.push(tag);
    releases.add(tag);
    return "";
  };
  recoverReleaseMetadata(f.plan, { ...f, run });
  assert.deepEqual(created, [`@fixture/a@${f.version}`]);
  uploaded.add(`@fixture/b@${f.version}`);
  recoverReleaseMetadata(f.plan, { ...f, run });
  assert.deepEqual(created, [
    `@fixture/a@${f.version}`,
    `@fixture/b@${f.version}`,
  ]);
  recoverReleaseMetadata(f.plan, { ...f, run });
  assert.equal(created.length, 2);
});

test("registry authentication errors cannot be treated as successful publication", (t) => {
  const f = fixture(t);
  assert.throws(
    () =>
      recoverReleaseMetadata(f.plan, {
        ...f,
        run(command) {
          assert.equal(command, "npm");
          throw registryError("E401");
        },
      }),
    /E401/,
  );
});

test("GitHub permission errors cannot be treated as missing releases", (t) => {
  const f = fixture(t);
  assert.throws(
    () =>
      recoverReleaseMetadata(f.plan, {
        ...f,
        run(command, args) {
          if (command === "npm") return JSON.stringify(f.version);
          assert.equal(args[0], "api");
          throw githubError(403);
        },
      }),
    /GitHub 403/,
  );
});

test("a plan from another version cannot create release metadata for this checkout", (t) => {
  const f = fixture(t);
  f.plan.plan[0][0].version = "2.0.0";
  assert.throws(
    () =>
      recoverReleaseMetadata(f.plan, {
        ...f,
        run() {
          assert.fail("Mismatched plans must stop before remote calls");
        },
      }),
    /does not match this checkout/,
  );
});
