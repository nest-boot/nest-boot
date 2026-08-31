import type { MigrationDiff, MigrationResult, MikroORM } from "@mikro-orm/core";
import { Migrator } from "@mikro-orm/migrations";

import { RowLevelSecurityMigrationGenerator } from "./row-level-security-migration-generator.js";

interface MigrationGeneratorLike {
  generate(
    diff: MigrationDiff,
    path?: string,
    name?: string,
  ): Promise<[string, string]>;
}

interface MigratorInternals {
  generator: MigrationGeneratorLike;
  hasSnapshot(): Promise<boolean>;
  init(): Promise<void>;
  initPaths(): Promise<void>;
  getSchemaDiff(blank: boolean, initial: boolean): Promise<MigrationDiff>;
  storeCurrentSchema(): Promise<void>;
}

/** MikroORM migrator that also creates migrations for policy-only RLS changes. */
export class RowLevelSecurityMigrator extends Migrator {
  /** Registers the RLS-aware migrator extension with a MikroORM instance. */
  static override register(orm: MikroORM): void {
    orm.config.registerExtension(
      "@mikro-orm/migrator",
      () => new RowLevelSecurityMigrator(orm.em as never),
    );
  }

  override async create(
    path?: string,
    blank = false,
    initial = false,
    name?: string,
  ): Promise<MigrationResult> {
    if (initial) {
      return await super.create(path, blank, initial, name);
    }

    const internals = this.getInternals();
    const offline = await internals.hasSnapshot();

    await (offline ? internals.initPaths() : internals.init());

    const diff = await internals.getSchemaDiff(blank, initial);

    if (diff.up.length === 0) {
      const hasPolicyChanges = await this.hasPendingPolicyChanges(diff);

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

  /** Checks whether schema or RLS policy changes require a new migration. */
  override async checkSchema(): Promise<boolean> {
    const internals = this.getInternals();
    const diff = await internals.getSchemaDiff(false, false);

    if (diff.up.length > 0) {
      return true;
    }

    return await this.hasPendingPolicyChanges(diff);
  }

  private async hasPendingPolicyChanges(diff: MigrationDiff): Promise<boolean> {
    const generator = this.getRowLevelSecurityGenerator();

    // TODO: Support MikroORM snapshot mode by comparing generated policy state
    // instead of only live database policies.
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
