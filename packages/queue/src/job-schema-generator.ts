import type { MikroORM } from "@mikro-orm/core";
import {
  type SchemaDifference,
  type SqlEntityManager,
  SqlSchemaGenerator,
} from "@mikro-orm/sql";

import { Job } from "./entities/job.entity.js";

/** Compares the Job table while preserving BullMQ's unmodeled schema objects. */
export class JobSchemaGenerator extends SqlSchemaGenerator {
  /**
   * Installs the generator through MikroORM's extension registration.
   * @param orm - ORM instance containing the Job mapping.
   */
  static override register(orm: MikroORM): void {
    orm.config.registerExtension(
      "@mikro-orm/schema-generator",
      () => new JobSchemaGenerator(orm.em as SqlEntityManager),
    );
  }

  /**
   * Leaves unrelated BullMQ objects out of removal statements, including rollback SQL.
   * @param diff - Difference computed by MikroORM from entity metadata.
   * @param options - SQL generation options.
   * @returns SQL for managed entities, including every Job column and index difference.
   */
  override diffToSQL(
    diff: SchemaDifference,
    options: Parameters<SqlSchemaGenerator["diffToSQL"]>[1],
  ): string {
    const schema = this.metadata.find(Job)?.schema;
    if (!schema) return super.diffToSQL(diff, options);
    const skippedTable = (name: string) =>
      this.options.skipTables?.some((pattern) =>
        typeof pattern === "string" ? pattern === name : pattern.test(name),
      );
    const removedTables = Object.fromEntries(
      Object.entries(diff.removedTables).filter(
        ([, table]) =>
          (table.schema !== schema || table.name === "job") &&
          !skippedTable(table.getShortestName(false)),
      ),
    );
    return super.diffToSQL(
      {
        ...diff,
        removedTables,
        newTables: Object.fromEntries(
          Object.entries(diff.newTables).filter(
            ([, table]) =>
              (table.schema !== schema || table.name === "job") &&
              !skippedTable(table.getShortestName(false)),
          ),
        ),
        newNativeEnums: diff.newNativeEnums.filter(
          (type) => type.schema !== schema || type.name === "job_state",
        ),
        removedNativeEnums: diff.removedNativeEnums.filter(
          (type) => type.schema !== schema || type.name === "job_state",
        ),
        removedRoutines: Object.fromEntries(
          Object.entries(diff.removedRoutines).filter(
            ([, routine]) => routine.schema !== schema,
          ),
        ),
        newRoutines: Object.fromEntries(
          Object.entries(diff.newRoutines).filter(
            ([, routine]) => routine.schema !== schema,
          ),
        ),
        orphanedForeignKeys: diff.orphanedForeignKeys.filter(
          (key) =>
            !Object.entries(diff.removedTables).some(
              ([name, table]) =>
                table.getShortestName(false) === key.localTableName &&
                !(name in removedTables),
            ),
        ),
      },
      options,
    );
  }
}
