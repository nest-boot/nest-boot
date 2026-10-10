import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const consumer = mkdtempSync(join(tmpdir(), "nest-boot-consumer-"));
const relativePath = relative(repository, consumer);
assert(
  relativePath.startsWith(`..${sep}`),
  "Consumer must be outside the workspace",
);
const workspace = JSON.parse(
  readFileSync(join(repository, "package.json"), "utf8"),
);

function pnpm(args, cwd = consumer, stdio = "inherit") {
  return execFileSync("pnpm", args, { cwd, stdio, timeout: 600_000 });
}

try {
  cpSync(join(repository, ".github/fixtures/consumer"), consumer, {
    recursive: true,
  });
  const dependencies = {};
  const imports = [];
  let packedPackages = 0;
  for (const directory of readdirSync(join(repository, "packages")).sort()) {
    const cwd = join(repository, "packages", directory);
    const manifest = JSON.parse(
      readFileSync(join(cwd, "package.json"), "utf8"),
    );
    if (manifest.private) continue;
    console.log(`Packing ${manifest.name}@${manifest.version}`);
    pnpm(["pack", "--pack-destination", consumer], cwd, "pipe");
    const tarball = `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
    dependencies[manifest.name] = `file:./${tarball}`;
    packedPackages++;
    // Applications install the public peers, including global type packages,
    // directly. pnpm checks every package's range against these selections.
    for (const [name, range] of Object.entries(
      manifest.peerDependencies ?? {},
    )) {
      if (
        !name.startsWith("@nest-boot/") &&
        !manifest.peerDependenciesMeta?.[name]?.optional
      ) {
        dependencies[name] ??= range;
      }
    }
    if (manifest.exports?.["."]) {
      const variable = `package${imports.length}`;
      imports.push(
        `import * as ${variable} from ${JSON.stringify(manifest.name)};\nvoid ${variable};`,
      );
    }
  }

  // The fixture is a real application: add its HTTP adapter and compiler.
  // Framework peers above come from public declarations, never devDependencies.
  dependencies["@nestjs/platform-express"] =
    workspace.devDependencies["@nestjs/platform-express"];
  dependencies.typescript = workspace.devDependencies.typescript;
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify(
      {
        name: "nest-boot-packed-consumer",
        private: true,
        type: "module",
        packageManager: workspace.packageManager,
        dependencies,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(consumer, "imports.ts"), `${imports.join("\n")}\n`);
  // Do not inherit the repository's peer-stripping hook or dependency overrides.
  writeFileSync(
    join(consumer, ".npmrc"),
    "strict-peer-dependencies=true\nauto-install-peers=true\nengine-strict=true\n",
  );
  pnpm([
    "install",
    "--ignore-pnpmfile",
    "--strict-peer-dependencies",
    "--no-frozen-lockfile",
  ]);
  pnpm(["exec", "tsc", "--project", "tsconfig.json"]);
  execFileSync(process.execPath, ["dist/main.js"], {
    cwd: consumer,
    stdio: "inherit",
    timeout: 60_000,
  });
  execFileSync(process.execPath, ["verify-eslint.mjs"], {
    cwd: consumer,
    stdio: "inherit",
    timeout: 60_000,
  });
  console.log(
    `Verified ${packedPackages} packed packages on ${process.version}`,
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
