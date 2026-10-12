import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
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
const queueConsumer = mkdtempSync(join(tmpdir(), "nest-boot-queue-consumer-"));
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
  const commandApplication = join(repository, "packages/command/src/test");
  cpSync(join(commandApplication, "src"), join(consumer, "src"), {
    recursive: true,
  });
  cpSync(
    join(commandApplication, "tsconfig.json"),
    join(consumer, "tsconfig.cli.json"),
  );
  const dependencies = {};
  const imports = [];
  let packedPackages = 0;
  const manifests = new Map();
  const tarballs = new Map();
  for (const directory of readdirSync(join(repository, "packages")).sort()) {
    const cwd = join(repository, "packages", directory);
    const manifestPath = join(cwd, "package.json");
    // Removed packages may leave ignored node_modules or build directories.
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.private) continue;
    console.log(`Packing ${manifest.name}@${manifest.version}`);
    pnpm(["pack", "--pack-destination", consumer], cwd, "pipe");
    const tarball = `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
    dependencies[manifest.name] = `file:./${tarball}`;
    manifests.set(manifest.name, manifest);
    tarballs.set(manifest.name, `file:${join(consumer, tarball)}`);
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
  pnpm(["exec", "tsc", "--project", "tsconfig.cli.json"]);
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
  // Exercise npm's bin links and both project entries outside the workspace.
  for (const mode of ["development", "production"]) {
    const output = execFileSync(
      "pnpm",
      ["exec", "nb", "hello", "Alice", "--loud", "--prefix", "Hello"],
      {
        cwd: consumer,
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: mode },
        timeout: 60_000,
      },
    );
    assert.equal(output.trim(), "Hello:ALICE!\nCLOSED");
  }
  console.log(
    "Packed command bin, source and compiled entries, DI and request context passed",
  );
  // Install only the transitive required dependencies of queue in a sibling
  // directory: the full consumer's node_modules must not hide missing peers.
  const queueDependencies = {};
  function addQueueDependency(name, range) {
    if (name in queueDependencies) return;
    const manifest = manifests.get(name);
    queueDependencies[name] = tarballs.get(name) ?? range;
    if (!manifest) return;
    for (const [dependency, version] of Object.entries(
      manifest.dependencies ?? {},
    )) {
      addQueueDependency(dependency, version);
    }
    for (const [dependency, version] of Object.entries(
      manifest.peerDependencies ?? {},
    )) {
      if (!manifest.peerDependenciesMeta?.[dependency]?.optional) {
        addQueueDependency(dependency, version);
      }
    }
  }
  addQueueDependency("@nest-boot/queue");
  addQueueDependency("@nest-boot/tsconfig");
  queueDependencies.typescript = workspace.devDependencies.typescript;
  queueDependencies["@types/node"] = workspace.devDependencies["@types/node"];
  cpSync(join(repository, ".github/fixtures/queue-consumer"), queueConsumer, {
    recursive: true,
  });
  writeFileSync(
    join(queueConsumer, "package.json"),
    JSON.stringify(
      {
        name: "nest-boot-plain-queue-consumer",
        private: true,
        type: "module",
        packageManager: workspace.packageManager,
        dependencies: queueDependencies,
      },
      null,
      2,
    ),
  );
  cpSync(join(consumer, ".npmrc"), join(queueConsumer, ".npmrc"));
  pnpm(
    [
      "install",
      "--ignore-pnpmfile",
      "--strict-peer-dependencies",
      "--no-frozen-lockfile",
    ],
    queueConsumer,
  );
  pnpm(["exec", "tsc", "--project", "tsconfig.json"], queueConsumer);
  execFileSync(process.execPath, ["dist/main.js"], {
    cwd: queueConsumer,
    stdio: "inherit",
    timeout: 60_000,
  });
  // Installing database support must not require the optional GraphQL stack.
  addQueueDependency("@nest-boot/database");
  // MikroORM drivers require their core/sql peers at exactly the same version.
  const ormVersion =
    manifests.get("@nest-boot/queue").devDependencies["@mikro-orm/pglite"];
  for (const name of ["core", "decorators", "reflection", "sql", "pglite"]) {
    queueDependencies[`@mikro-orm/${name}`] = ormVersion;
  }
  cpSync(
    join(repository, ".github/fixtures/queue-database-consumer"),
    queueConsumer,
    { recursive: true },
  );
  writeFileSync(
    join(queueConsumer, "package.json"),
    JSON.stringify(
      {
        name: "nest-boot-database-queue-consumer",
        private: true,
        type: "module",
        packageManager: workspace.packageManager,
        dependencies: queueDependencies,
      },
      null,
      2,
    ),
  );
  pnpm(
    [
      "install",
      "--ignore-pnpmfile",
      "--strict-peer-dependencies",
      "--no-frozen-lockfile",
    ],
    queueConsumer,
  );
  // Check the queue persistence declarations independently of DatabaseModule
  // and PGlite's existing declaration errors, without installing GraphQL peers.
  pnpm(["exec", "tsc", "--project", "tsconfig.types.json"], queueConsumer);
  pnpm(
    ["exec", "tsc", "--project", "tsconfig.json", "--skipLibCheck"],
    queueConsumer,
  );
  execFileSync(process.execPath, ["dist/main.js"], {
    cwd: queueConsumer,
    stdio: "inherit",
    timeout: 60_000,
  });
  console.log(
    `Verified ${packedPackages} packed packages on ${process.version}`,
  );
} finally {
  rmSync(queueConsumer, { recursive: true, force: true });
  rmSync(consumer, { recursive: true, force: true });
}
