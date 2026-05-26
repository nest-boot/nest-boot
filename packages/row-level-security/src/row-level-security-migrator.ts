import type { MigrationDiff, MigrationResult, MikroORM } from "@mikro-orm/core";
import { Migrator } from "@mikro-orm/migrations";

import { RowLevelSecurityMigrationGenerator } from "./row-level-security-migration-generator";

interface MigrationGeneratorLike {
  generate(
    diff: MigrationDiff,
    path?: string,
    name?: string,
  ): Promise<[string, string]>;
}

interface MigratorInternals {
  generator: MigrationGeneratorLike;
  ensureMigrationsDirExists(): Promise<void>;
  getSchemaDiff(blank: boolean, initial: boolean): Promise<MigrationDiff>;
  storeCurrentSchema(): Promise<void>;
}

/** MikroORM migrator that also creates migrations for policy-only RLS changes. */
export class RowLevelSecurityMigrator extends Migrator {
  static override register(orm: MikroORM): void {
    orm.config.registerExtension(
      "@mikro-orm/migrator",
      () => new RowLevelSecurityMigrator(orm.em as never),
    );
  }

  override async createMigration(
    path?: string,
    blank = false,
    initial = false,
    name?: string,
  ): Promise<MigrationResult> {
    if (initial) {
      return await super.createMigration(path, blank, initial, name);
    }

    const internals = this.getInternals();

    await internals.ensureMigrationsDirExists();

    const diff = await internals.getSchemaDiff(blank, initial);

    if (diff.up.length === 0) {
      const generator = this.getRowLevelSecurityGenerator();
      const hasPolicyChanges = generator
        ? await generator.hasPendingPolicyChanges(diff)
        : false;

      if (!hasPolicyChanges) {
        return { fileName: "", code: "", diff };
      }
    }

    const migration = await internals.generator.generate(diff, path, name);

    await internals.storeCurrentSchema();

    return {
      fileName: migration[1],
      code: migration[0],
      diff,
    };
  }

  override async checkMigrationNeeded(): Promise<boolean> {
    const internals = this.getInternals();

    await internals.ensureMigrationsDirExists();

    const diff = await internals.getSchemaDiff(false, false);

    if (diff.up.length > 0) {
      return true;
    }

    const generator = this.getRowLevelSecurityGenerator();

    return generator ? await generator.hasPendingPolicyChanges(diff) : false;
  }

  private getRowLevelSecurityGenerator() {
    const generator = this.getInternals().generator;

    return generator instanceof RowLevelSecurityMigrationGenerator
      ? generator
      : undefined;
  }

  private getInternals() {
    return this as unknown as MigratorInternals;
  }
}
