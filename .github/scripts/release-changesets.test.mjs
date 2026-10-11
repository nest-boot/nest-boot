import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { checkReleaseChannel } from "./release-channel.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const cli = join(repository, "node_modules/@changesets/cli/bin.js");
const config = JSON.parse(
  readFileSync(join(repository, ".changeset/config.json"), "utf8"),
);

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "changesets-release-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(
      join(cwd, path),
      typeof content === "string" ? content : JSON.stringify(content, null, 2),
    );
  };
  const read = (path) => JSON.parse(readFileSync(join(cwd, path), "utf8"));
  const run = (...args) =>
    execFileSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    });
  const manifest = (name) => read(`packages/${name}/package.json`);
  const changeset = (name, type = "patch") =>
    write(
      `.changeset/${name}.md`,
      `---\n"@fixture/library": ${type}\n---\n\n${name}\n`,
    );
  write("package.json", {
    name: "fixture",
    private: true,
    packageManager: "pnpm@10.30.3",
  });
  write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  write(".changeset/config.json", config);
  write("packages/library/package.json", {
    name: "@fixture/library",
    version: "1.0.0",
    files: ["dist"],
    main: "dist/index.js",
  });
  write("packages/library/dist/index.js", "exports.value = 1;\n");
  write("packages/consumer/package.json", {
    name: "@fixture/consumer",
    version: "1.0.0",
    dependencies: { "@fixture/library": "workspace:^1.0.0" },
  });
  write("packages/unrelated/package.json", {
    name: "@fixture/unrelated",
    version: "2.0.0",
  });
  write("packages/private/package.json", {
    name: "@fixture/private",
    version: "0.0.0",
    private: true,
    dependencies: { "@fixture/library": "workspace:*" },
  });
  execFileSync("git", ["init", "-b", "main"], { cwd, stdio: "pipe" });
  execFileSync("git", ["add", "."], { cwd, stdio: "pipe" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Release test",
      "-c",
      "user.email=release@example.com",
      "commit",
      "-m",
      "chore: fixture",
    ],
    { cwd, stdio: "pipe" },
  );
  return { cwd, write, read, run, manifest, changeset };
}

test("empty tooling changesets leave all package versions unchanged", (t) => {
  const f = fixture(t);
  f.write(".changeset/tooling.md", "---\n---\n\nRelease tooling.\n");
  f.run("version");
  assert.equal(f.manifest("library").version, "1.0.0");
  assert.equal(f.manifest("consumer").version, "1.0.0");
  assert.equal(f.manifest("private").version, "0.0.0");
  assert.equal(existsSync(join(f.cwd, ".changeset/tooling.md")), false);
});

test("stable breaking changes update runtime dependents without versioning private apps", (t) => {
  const f = fixture(t);
  f.changeset("breaking", "major");
  f.run("version");
  assert.equal(f.manifest("library").version, "2.0.0");
  assert.equal(f.manifest("consumer").version, "1.0.1");
  assert.equal(
    f.manifest("consumer").dependencies["@fixture/library"],
    "workspace:^2.0.0",
  );
  assert.equal(f.manifest("unrelated").version, "2.0.0");
  assert.equal(f.manifest("private").version, "0.0.0");
  assert.match(
    readFileSync(join(f.cwd, "packages/library/CHANGELOG.md"), "utf8"),
    /breaking/,
  );
  checkReleaseChannel("main", { cwd: f.cwd, publish: true });
});

test("beta increments, graduates every prerelease and resumes stable patches", (t) => {
  const f = fixture(t);
  f.run("pre", "enter", "beta");
  f.changeset("feature", "minor");
  f.run("version");
  assert.equal(f.manifest("library").version, "1.1.0-beta.0");
  assert.equal(f.manifest("consumer").version, "1.0.1-beta.0");
  assert.equal(f.manifest("unrelated").version, "2.0.0");
  checkReleaseChannel("beta", { cwd: f.cwd, publish: true });
  assert.throws(
    () => checkReleaseChannel("main", { cwd: f.cwd }),
    /exit prerelease mode/,
  );

  f.changeset("prerelease-fix");
  f.run("version");
  assert.equal(f.manifest("library").version, "1.1.0-beta.1");
  f.run("pre", "exit");
  checkReleaseChannel("main", { cwd: f.cwd });
  assert.throws(
    () => checkReleaseChannel("main", { cwd: f.cwd, publish: true }),
    /stable version PR/,
  );
  assert.throws(
    () => checkReleaseChannel("beta", { cwd: f.cwd }),
    /pre enter beta/,
  );
  f.run("version");
  assert.equal(f.manifest("library").version, "1.1.0");
  assert.equal(f.manifest("consumer").version, "1.0.1");
  assert.equal(
    f.manifest("consumer").dependencies["@fixture/library"],
    "workspace:^1.1.0",
  );
  assert.equal(existsSync(join(f.cwd, ".changeset/pre.json")), false);
  checkReleaseChannel("main", { cwd: f.cwd, publish: true });
  f.changeset("stable-fix");
  f.run("version");
  assert.equal(f.manifest("library").version, "1.1.1");
});

test("official pack command keeps the planned channel and resolves workspace dependencies", (t) => {
  const f = fixture(t);
  f.write("publish-plan.json", {
    version: 1,
    plan: [
      [
        {
          kind: "publish",
          name: "@fixture/library",
          version: "1.0.0",
          tag: "latest",
          access: "public",
        },
      ],
      [
        {
          kind: "publish",
          name: "@fixture/consumer",
          version: "1.0.0",
          tag: "latest",
          access: "public",
        },
      ],
    ],
  });
  f.run(
    "pack",
    "--from-publish-plan",
    "publish-plan.json",
    "--out-dir",
    "packed",
  );
  const releases = f.read("packed/publish-plan.json").plan.flat();
  assert.equal(releases.length, 2);
  for (const release of releases) {
    assert.equal(release.tag, "latest");
    assert.equal(release.access, "public");
    assert.match(release.tarball.integrity, /^sha256-/);
  }
  const tarball = join(f.cwd, "packed", releases[1].tarball.path);
  const packed = JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(packed.dependencies["@fixture/library"], "^1.0.0");
  const files = execFileSync(
    "tar",
    ["-tf", join(f.cwd, "packed", releases[0].tarball.path)],
    { encoding: "utf8" },
  );
  assert.match(files, /package\/dist\/index.js/);
});

test("release branches reject missing or mismatched prerelease state", (t) => {
  const f = fixture(t);
  assert.throws(
    () => checkReleaseChannel("feature", { cwd: f.cwd }),
    /Unsupported release branch/,
  );
  assert.throws(
    () => checkReleaseChannel("beta", { cwd: f.cwd }),
    /pre enter beta/,
  );
  f.run("pre", "enter", "next");
  assert.throws(
    () => checkReleaseChannel("beta", { cwd: f.cwd }),
    /pre enter beta/,
  );
  rmSync(join(f.cwd, ".changeset/pre.json"));
  f.write("packages/library/package.json", {
    ...f.manifest("library"),
    version: "1.1.0-beta.0",
  });
  assert.throws(
    () => checkReleaseChannel("main", { cwd: f.cwd }),
    /Prerelease manifests/,
  );
});

test("publish plans retain beta tags, retry only missing versions, and stop on registry errors", async (t) => {
  const f = fixture(t);
  f.run("pre", "enter", "beta");
  f.changeset("feature", "minor");
  f.run("version");
  const published = new Map([
    ["@fixture/library", ["1.0.0"]],
    ["@fixture/consumer", ["1.0.0"]],
    ["@fixture/unrelated", ["2.0.0"]],
  ]);
  let unauthorized = false;
  const server = createServer((request, response) => {
    const name = decodeURIComponent(request.url.slice(1));
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    if (unauthorized) {
      response.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    const versions = published.get(name);
    if (!versions) {
      response.writeHead(404).end(JSON.stringify({ error: "Not found" }));
      return;
    }
    response.end(
      JSON.stringify({
        name,
        "dist-tags": { latest: versions[0] },
        versions: Object.fromEntries(
          versions.map((version) => [version, { name, version }]),
        ),
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const plan = async () => {
    await promisify(execFile)(
      process.execPath,
      [cli, "publish-plan", "--output", "plan.json"],
      {
        cwd: f.cwd,
        env: {
          ...process.env,
          npm_config_registry: `http://127.0.0.1:${server.address().port}`,
          npm_config_cache: join(f.cwd, "npm-cache"),
          npm_config_fetch_retries: "0",
        },
      },
    );
    return f.read("plan.json").plan.flat();
  };
  let releases = await plan();
  assert.deepEqual(
    releases.map(({ name }) => name),
    ["@fixture/library", "@fixture/consumer"],
  );
  assert.ok(
    releases.every(({ tag, access }) => tag === "beta" && access === "public"),
  );
  published.get("@fixture/library").push(f.manifest("library").version);
  releases = await plan();
  assert.deepEqual(
    releases.map(({ name }) => name),
    ["@fixture/consumer"],
  );
  published.get("@fixture/consumer").push(f.manifest("consumer").version);
  assert.deepEqual(await plan(), []);
  unauthorized = true;
  await assert.rejects(plan(), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stdout + error.stderr, /E401|Unauthorized/);
    return true;
  });
  assert.equal(f.manifest("library").version, "1.1.0-beta.0");
});
