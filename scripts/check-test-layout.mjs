import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ignored = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".cache",
  ".turbo",
  ".tanstack",
  ".output",
  ".vitest",
  "playwright-report",
  "test-results",
]);
const problems = [];
let units = 0;
let integration = 0;
let endToEnd = 0;
let browser = 0;
let typeTests = 0;

function hasAdjacentImplementation(stem) {
  return [
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
  ].some((extension) => existsSync(stem + extension));
}

function visit(directory, packageRoot, browserDirectory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) visit(file, packageRoot, browserDirectory);
      continue;
    }
    if (!entry.isFile()) continue;

    const rel = relative(packageRoot, file);

    if (/\.e2e-spec\.[cm]?[jt]sx?$/.test(entry.name)) {
      problems.push(
        `${file}: E2E tests use test/e2e/**/*.spec.* instead of *.e2e-spec.*`,
      );
      continue;
    }

    if (/\.(?:type-test|test-d)\.[cm]?[jt]sx?$/.test(entry.name)) {
      problems.push(`${file}: type tests use the *.spec-d.* naming convention`);
      continue;
    }

    if (/\.spec-d\.[cm]?[jt]sx?$/.test(entry.name)) {
      typeTests++;
      if (rel.startsWith(`test${sep}`)) {
        if (
          !rel.startsWith(`test${sep}integration${sep}`) &&
          !rel.startsWith(`test${sep}e2e${sep}`)
        ) {
          problems.push(
            `${file}: type tests under test/ must live in test/integration/ or test/e2e/`,
          );
        }
        continue;
      }

      const stem = file.replace(/\.spec-d\.[cm]?[jt]sx?$/, "");
      if (!hasAdjacentImplementation(stem)) {
        problems.push(
          `${file}: co-located type tests must share their adjacent implementation's filename stem`,
        );
      }
      continue;
    }

    if (/\.(?:spec|test)\.[cm]?[jt]sx?$/.test(entry.name)) {
      if (browserDirectory && rel.startsWith(`${browserDirectory}${sep}`)) {
        browser++;
        continue;
      }

      if (rel.startsWith(`test${sep}`)) {
        if (!/\.spec\.[cm]?[jt]sx?$/.test(entry.name)) {
          problems.push(
            `${file}: integration and E2E tests use the *.spec.* naming convention`,
          );
          continue;
        }
        if (rel.startsWith(`test${sep}integration${sep}`)) {
          integration++;
        } else if (rel.startsWith(`test${sep}e2e${sep}`)) {
          endToEnd++;
        } else {
          problems.push(
            `${file}: tests under test/ must live in test/integration/ or test/e2e/`,
          );
        }
        continue;
      }

      units++;
      if (!/\.spec\.[cm]?[jt]sx?$/.test(entry.name)) {
        problems.push(`${file}: unit tests use the *.spec.* naming convention`);
      }
      const stem = file.replace(/\.(?:spec|test)\.[cm]?[jt]sx?$/, "");
      if (!hasAdjacentImplementation(stem)) {
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
    `Test layout verified: ${units} unit files, ${integration} integration files, ${endToEnd} E2E files, ${browser} browser files, ${typeTests} type test files.\n`,
  );
}
