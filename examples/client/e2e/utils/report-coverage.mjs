import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const statusOrder = ["covered", "partial", "missing"];
const statusWeight = {
  covered: 1,
  partial: 0.5,
  missing: 0,
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const e2eDir = resolve(currentDir, "..");
const coveragePath = resolve(e2eDir, "coverage.json");
const failOnMissing = process.argv.includes("--fail-on-missing");
const failOnPartial = process.argv.includes("--fail-on-partial");
const jsonOutput = process.argv.includes("--json");

const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
const items = coverage.items ?? [];
const validationErrors = await validateCoverageItems(items);

if (validationErrors.length > 0) {
  console.error("Invalid e2e coverage matrix:");
  for (const error of validationErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const counts = Object.fromEntries(statusOrder.map((status) => [status, 0]));

for (const item of items) {
  counts[item.status] += 1;
}

const total = items.length;
const weighted = items.reduce(
  (sum, item) => sum + statusWeight[item.status],
  0,
);
const summary = {
  total,
  covered: counts.covered,
  partial: counts.partial,
  missing: counts.missing,
  coveredPercent: percent(counts.covered, total),
  weightedPercent: percent(weighted, total),
};

if (jsonOutput) {
  console.log(JSON.stringify({ summary, items }, null, 2));
} else {
  printReport(summary, items);
}

if (failOnMissing && counts.missing > 0) {
  process.exitCode = 1;
}

if (failOnPartial && counts.partial > 0) {
  process.exitCode = 1;
}

async function validateCoverageItems(items) {
  const errors = [];

  if (!Array.isArray(items)) {
    return ["coverage.json must contain an items array."];
  }

  for (const [index, item] of items.entries()) {
    const label = `items[${index}]`;

    if (!item.domain) {
      errors.push(`${label}.domain is required.`);
    }

    if (!item.scenario) {
      errors.push(`${label}.scenario is required.`);
    }

    if (!statusOrder.includes(item.status)) {
      errors.push(`${label}.status must be one of ${statusOrder.join(", ")}.`);
    }

    if (!Array.isArray(item.specs)) {
      errors.push(`${label}.specs must be an array.`);
      continue;
    }

    if (item.status !== "missing" && item.specs.length === 0) {
      errors.push(`${label}.specs must reference at least one spec file.`);
    }

    for (const spec of item.specs) {
      try {
        await access(resolve(e2eDir, spec));
      } catch {
        errors.push(`${label}.specs references missing file: ${spec}.`);
      }
    }
  }

  return errors;
}

function printReport(summary, items) {
  console.log("Client e2e functional coverage");
  console.log("");
  console.log(
    `Covered: ${summary.covered}/${summary.total} (${summary.coveredPercent})`,
  );
  console.log(`Partial: ${summary.partial}/${summary.total}`);
  console.log(`Missing: ${summary.missing}/${summary.total}`);
  console.log(`Weighted: ${summary.weightedPercent} (partial counts as 0.5)`);

  const domains = [...new Set(items.map((item) => item.domain))];

  for (const domain of domains) {
    console.log("");
    console.log(domain);

    for (const item of items.filter((entry) => entry.domain === domain)) {
      const specs = item.specs.length > 0 ? item.specs.join(", ") : "-";
      console.log(`  [${item.status}] ${item.scenario}`);
      console.log(`    specs: ${specs}`);

      if (item.notes) {
        console.log(`    notes: ${item.notes}`);
      }
    }
  }
}

function percent(value, total) {
  if (total === 0) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}
