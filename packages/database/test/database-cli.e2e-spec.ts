import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commandDirectory = dirname(
  fileURLToPath(import.meta.resolve("@nest-boot/command/package.json")),
);

it.each([false, true])(
  "runs database commands through nb without a MikroORM config file (production: %s)",
  async (production) => {
    const directory = await mkdtemp(join(tmpdir(), "nb-database-process-"));
    try {
      await mkdir(join(directory, "node_modules/@nest-boot"), {
        recursive: true,
      });
      await symlink(
        packageDirectory,
        join(directory, "node_modules/@nest-boot/database"),
        "dir",
      );
      await symlink(
        commandDirectory,
        join(directory, "node_modules/@nest-boot/command"),
        "dir",
      );
      await symlink(
        join(packageDirectory, "node_modules/@mikro-orm"),
        join(directory, "node_modules/@mikro-orm"),
        "dir",
      );
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify({ type: "module" }),
      );
      const output = production ? "dist" : "src";
      await mkdir(join(directory, output));
      await writeFile(
        join(directory, output, production ? "cli.js" : "cli.ts"),
        `
import { EntitySchema } from '@mikro-orm/core';
import { PgliteDriver } from '@mikro-orm/pglite';
import { DatabaseModule } from '@nest-boot/database';
import { CommandFactory, CommandModule } from '@nest-boot/command';
const core = new EntitySchema({ name: 'CoreRecord', properties: { id: { type: 'integer', primary: true } } });
const feature = new EntitySchema({ name: 'FeatureRecord', properties: { id: { type: 'integer', primary: true } } });
await CommandFactory.run({ module: class CliModule {}, imports: [
  CommandModule,
  DatabaseModule.forRoot({ driver: PgliteDriver, dbName: 'memory://', entities: [core], migrations: { path: 'dist/migrations', pathTs: 'src/migrations', emit: '${production ? "cjs" : "ts"}' } }),
  DatabaseModule.forFeatureAsync({ useFactory: () => Promise.resolve([feature]) }),
] });
`,
      );
      const result = spawnSync(
        process.execPath,
        [
          join(commandDirectory, "bin/nb"),
          "database",
          "schema",
          "create",
          "--dump",
        ],
        {
          cwd: directory,
          encoding: "utf8",
          timeout: 20000,
          env: {
            ...process.env,
            VITEST: undefined,
            NODE_ENV: production ? "production" : "development",
          },
        },
      );
      expect({ status: result.status, stderr: result.stderr }).toMatchObject({
        status: 0,
      });
      expect(result.stdout).toContain('create table "core_record"');
      expect(result.stdout).toContain('create table "feature_record"');
      const migration = spawnSync(
        process.execPath,
        [
          join(commandDirectory, "bin/nb"),
          "database",
          "migration",
          "create",
          "--blank",
          "--name",
          "proof",
        ],
        {
          cwd: directory,
          encoding: "utf8",
          timeout: 20000,
          env: {
            ...process.env,
            VITEST: undefined,
            NODE_ENV: production ? "production" : "development",
          },
        },
      );
      expect({
        status: migration.status,
        output: migration.stdout,
        error: migration.stderr,
      }).toMatchObject({ status: 0 });
      expect(
        (await readdir(join(directory, output, "migrations"))).some((name) =>
          name.endsWith(production ? "_proof.cjs" : "_proof.ts"),
        ),
      ).toBe(true);
      const applied = spawnSync(
        process.execPath,
        [join(commandDirectory, "bin/nb"), "database", "migration", "up"],
        {
          cwd: directory,
          encoding: "utf8",
          timeout: 20000,
          env: {
            ...process.env,
            VITEST: undefined,
            NODE_ENV: production ? "production" : "development",
          },
        },
      );
      expect({
        status: applied.status,
        output: applied.stdout,
        error: applied.stderr,
      }).toMatchObject({ status: 0 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  25000,
);
