import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ignored = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".cache",
  ".turbo",
  ".tanstack",
  ".output",
  "playwright-report",
  "test-results",
]);
const problems = [];
let units = 0;
let endToEnd = 0;
let browser = 0;

function visit(directory, packageRoot, browserDirectory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) visit(file, packageRoot, browserDirectory);
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.e2e-spec\.[cm]?[jt]sx?$/.test(entry.name)) {
      endToEnd++;
      if (!relative(packageRoot, file).startsWith(`test${sep}`)) {
        problems.push(
          `${file}: E2E tests belong under the package's test/ directory`,
        );
      }
    } else if (/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(entry.name)) {
      if (
        browserDirectory &&
        relative(packageRoot, file).startsWith(`${browserDirectory}${sep}`)
      ) {
        browser++;
        continue;
      }
      units++;
      if (!/\.spec\.[cm]?[jt]sx?$/.test(entry.name)) {
        problems.push(`${file}: unit tests use the *.spec.* naming convention`);
      }
      const stem = file.replace(/\.(?:spec|test)\.[cm]?[jt]sx?$/, "");
      if (
        ![
          ".ts",
          ".tsx",
          ".mts",
          ".cts",
          ".js",
          ".jsx",
          ".mjs",
          ".cjs",
          ".json",
        ].some((extension) => existsSync(stem + extension))
      ) {
        problems.push(
          `${file}: unit tests must share their adjacent implementation's filename stem`,
        );
      }
    }
  }
}

for (const directory of ["packages", "examples"]) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const root = join(directory, entry.name);
    const playwright = join(root, "playwright.config.ts");
    const browserDirectory = existsSync(playwright)
      ? readFileSync(playwright, "utf8").match(
          /testDir:\s*["']\.\/([^"']+)["']/,
        )?.[1]
      : undefined;
    visit(root, root, browserDirectory);
  }
}

if (problems.length) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Test layout verified: ${units} unit files, ${endToEnd} E2E files, ${browser} browser files.\n`,
  );
}
