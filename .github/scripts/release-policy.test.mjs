import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { getReleaseSpecifier } from "./release-policy.mjs";

test("Nx also keeps implicitly bumped dependents on the prerelease channel", () => {
  const config = JSON.parse(
    readFileSync(new URL("../../nx.json", import.meta.url), "utf8"),
  );
  assert.equal(config.release.version.applyPreidToDependents, true);
});

test("beta explicitly increments prereleases instead of interpreting breaking commits", () => {
  assert.equal(
    getReleaseSpecifier("beta", [
      { name: "@nest-boot/auth", version: "8.0.2" },
      { name: "@nest-boot/storage", version: "8.0.0-beta.4" },
      { name: "@nest-boot/row-level-security", version: "8.0.4-beta.0" },
    ]),
    "prerelease",
  );
});

for (const version of [
  "9.0.0-beta.0",
  "9.0.0-beta.1",
  "7.0.0",
  "8.0.0-alpha.1",
  "8.0.0-beta.invalid",
  "invalid",
  undefined,
]) {
  test(`beta rejects an invalid release baseline: ${version}`, () => {
    assert.throws(
      () => getReleaseSpecifier("beta", [{ name: "@nest-boot/auth", version }]),
      /@nest-boot\/auth.*v8/,
    );
  });
}

test("private projects do not constrain the public release line", () => {
  assert.equal(
    getReleaseSpecifier("beta", [
      { name: "example", version: "0.0.1", private: true },
    ]),
    "prerelease",
  );
});

test("main retains conventional-commit versioning without a v8 restriction", () => {
  assert.equal(
    getReleaseSpecifier("main", [
      { name: "@nest-boot/auth", version: "9.0.0" },
    ]),
    null,
  );
});

test("an unexpected release branch fails closed", () => {
  assert.throws(
    () => getReleaseSpecifier("feature", []),
    /Unsupported release branch/,
  );
});

test("beta rejects stale v9 tags even after manifests have been corrected", () => {
  assert.throws(
    () =>
      getReleaseSpecifier(
        "beta",
        [{ name: "@nest-boot/auth", version: "8.0.2" }],
        ["@nest-boot/auth@9.0.0-beta.0"],
      ),
    /stale tag @nest-boot\/auth@9\.0\.0-beta\.0/,
  );
});

test("legacy v7 and current v8 tags remain valid", () => {
  assert.equal(
    getReleaseSpecifier(
      "beta",
      [{ name: "@nest-boot/auth", version: "8.0.2" }],
      ["@nest-boot/auth@7.13.6", "@nest-boot/auth@8.0.2"],
    ),
    "prerelease",
  );
});
