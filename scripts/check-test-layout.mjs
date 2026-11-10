import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ignored = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".cache",
  ".turbo",
]);
const problems = [];
let units = 0;
let endToEnd = 0;

function visit(directory, packageRoot) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) visit(file, packageRoot);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".e2e-spec.ts")) {
      endToEnd++;
      if (!relative(packageRoot, file).startsWith(`test${sep}`)) {
        problems.push(
          `${file}: E2E tests belong under the package's test/ directory`,
        );
      }
    } else if (entry.name.endsWith(".spec.ts")) {
      units++;
      const stem = file.slice(0, -".spec.ts".length);
      if (
        ![".ts", ".js", ".mjs", ".cjs", ".json"].some((extension) =>
          existsSync(stem + extension),
        )
      ) {
        problems.push(
          `${file}: unit tests must share their adjacent implementation's filename stem`,
        );
      }
    }
  }
}

for (const entry of readdirSync("packages", { withFileTypes: true })) {
  if (entry.isDirectory()) {
    const root = join("packages", entry.name);
    visit(root, root);
  }
}

if (problems.length) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Test layout verified: ${units} unit files, ${endToEnd} E2E files.\n`,
  );
}
