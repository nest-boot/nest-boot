import { TSMigrationGenerator } from "@mikro-orm/migrations";

import { getPolicyDefinitions } from "./decorators/policy.decorator";
import { PolicyCommand } from "./enums/policy-command.enum";
import { PolicyMode } from "./enums/policy-mode.enum";
import type { PolicyEntityMetadata } from "./interfaces/policy-metadata.interface";
import type {
  EntityMetadataLike,
  MigrationDiff,
  PolicyRow,
  RowLevelSecurityDefinition,
  RowLevelSecurityMigrationGeneratorDriverLike,
  TableReference,
} from "./interfaces/row-level-security-migration-generator.interface";
import { createPolicyBootstrapSqlStatements } from "./utils/create-policy-bootstrap-sql-statements";
import { createPolicyDownSql } from "./utils/create-policy-down-sql";
import { createPolicyUpSqlStatements } from "./utils/create-policy-up-sql-statements";
import { escapeSqlLiteral } from "./utils/escape-sql-literal";

export class RowLevelSecurityMigrationGenerator extends TSMigrationGenerator {
  private existingPolicyDefinitions?: RowLevelSecurityDefinition[];
  private currentPolicyDefinitions?: RowLevelSecurityDefinition[];

  override async generate(
    diff: MigrationDiff,
    path?: string,
    name?: string,
  ): Promise<[string, string]> {
    const entityMetadata = this.getEntityMetadata();
    const currentPolicyDefinitions = this.getPolicyDefinitions(entityMetadata);
    const tableReferences = getEntityTableReferences(entityMetadata);

    this.existingPolicyDefinitions =
      await this.getExistingPolicyDefinitionsFromDatabase(tableReferences);
    this.currentPolicyDefinitions = currentPolicyDefinitions;

    try {
      return await super.generate(diff, path, name);
    } finally {
      this.existingPolicyDefinitions = undefined;
      this.currentPolicyDefinitions = undefined;
    }
  }

  override generateMigrationFile(
    className: string,
    diff: MigrationDiff,
  ): string {
    const currentPolicyDefinitions =
      this.currentPolicyDefinitions ?? this.getPolicyDefinitions();
    const { added, removed } = this.getPolicyDefinitionChanges(
      diff,
      currentPolicyDefinitions,
    );

    if (added.length === 0 && removed.length === 0) {
      return super.generateMigrationFile(className, diff);
    }

    const policyDiff = {
      up: [
        ...removed.map((definition) => createPolicyDownSql(definition)),
        ...diff.up,
        ...(added.length > 0 ? createPolicyBootstrapSqlStatements() : []),
        ...getDefinitionBootstrapSql(added),
        ...added.flatMap((definition) =>
          createPolicyUpSqlStatements(definition),
        ),
      ],
      down: [
        ...added.map((definition) => createPolicyDownSql(definition)),
        ...diff.down,
        ...(removed.length > 0 ? createPolicyBootstrapSqlStatements() : []),
        ...getDefinitionBootstrapSql(removed),
        ...removed.flatMap((definition) =>
          createPolicyUpSqlStatements(definition),
        ),
      ],
    };

    const migrationFile = super.generateMigrationFile(className, policyDiff);

    return migrationFile
      .replace(
        "import { Migration } from '@mikro-orm/migrations';",
        "import { RowLevelSecurityMigration } from '@nest-boot/row-level-security';",
      )
      .replace("extends Migration", "extends RowLevelSecurityMigration");
  }

  private getPolicyDefinitionChanges(
    diff: MigrationDiff,
    currentPolicyDefinitions: RowLevelSecurityDefinition[],
  ) {
    if (!this.existingPolicyDefinitions) {
      return {
        added: this.getRelevantPolicyDefinitions(
          diff,
          currentPolicyDefinitions,
        ),
        removed: [],
      };
    }

    const existingPolicyDefinitions = this.existingPolicyDefinitions;

    return {
      added: currentPolicyDefinitions.filter(
        (definition) =>
          !hasPolicyDefinition(existingPolicyDefinitions, definition) ||
          isPolicyDefinitionIntroduced(definition, diff.up),
      ),
      removed: existingPolicyDefinitions.filter(
        (definition) =>
          !hasPolicyDefinition(currentPolicyDefinitions, definition),
      ),
    };
  }

  private getRelevantPolicyDefinitions(
    diff: MigrationDiff,
    policyDefinitions: RowLevelSecurityDefinition[],
  ) {
    if (diff.up.length === 0 && diff.down.length === 0) {
      return policyDefinitions;
    }

    return policyDefinitions.filter((definition) =>
      isPolicyDefinitionIntroduced(definition, diff.up),
    );
  }

  private getPolicyDefinitions(
    metadata = this.getEntityMetadata(),
  ): RowLevelSecurityDefinition[] {
    return sortPolicyDefinitions(
      metadata.flatMap((entityMetadata) => {
        if (!entityMetadata.class) {
          return [];
        }

        const entityName = getEntityName(entityMetadata);
        const schemaName = normalizeSchemaName(entityMetadata.schema);
        const tableName = getTableName(entityMetadata);
        const policyEntityMetadata: PolicyEntityMetadata = {
          entityName,
          schemaName,
          tableName,
          properties: entityMetadata.properties,
        };

        return getPolicyDefinitions(
          entityMetadata.class,
          policyEntityMetadata,
        ).map((policy) => ({
          entityName,
          schemaName,
          tableName,
          policyName: policy.name,
          mode: policy.mode,
          command: policy.command,
          using: policy.using,
          withCheck: policy.withCheck,
          roles: policy.roles,
          bootstrapSql: policy.bootstrapSql,
        }));
      }),
    );
  }

  private getEntityMetadata() {
    const driver = this
      .driver as unknown as RowLevelSecurityMigrationGeneratorDriverLike;
    const allMetadata = (
      driver.getMetadata?.() ?? driver.config?.getMetadata?.()
    )?.getAll();

    if (!allMetadata) {
      throw new Error("MikroORM metadata storage is not available");
    }

    return Array.isArray(allMetadata)
      ? allMetadata
      : Object.values(allMetadata);
  }

  private async getExistingPolicyDefinitionsFromDatabase(
    tableReferences: TableReference[],
  ) {
    const uniqueTableReferences = dedupeTableReferences(tableReferences);

    if (uniqueTableReferences.length === 0) {
      return [];
    }

    const driver = this
      .driver as unknown as RowLevelSecurityMigrationGeneratorDriverLike;
    const connection = driver.getConnection?.();

    if (!connection) {
      return [];
    }

    const rows = await connection.execute<PolicyRow[]>(/* SQL */ `
      SELECT
        p.polname AS policy_name,
        n.nspname AS schema_name,
        c.relname AS table_name,
        p.polpermissive AS permissive,
        p.polcmd AS command,
        pg_get_expr(p.polqual, p.polrelid) AS qual,
        pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
      FROM pg_policy p
      INNER JOIN pg_class c ON c.oid = p.polrelid
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE (n.nspname, c.relname) in (${uniqueTableReferences
        .map(
          (table) =>
            `('${escapeSqlLiteral(table.schemaName)}', '${escapeSqlLiteral(table.tableName)}')`,
        )
        .join(", ")})
      ORDER BY n.nspname, c.relname
    `);

    return sortPolicyDefinitions(rows.map(createPolicyDefinitionFromPolicyRow));
  }
}

function getDefinitionBootstrapSql(definitions: RowLevelSecurityDefinition[]) {
  return [
    ...new Set(
      definitions.flatMap((definition) => definition.bootstrapSql ?? []),
    ),
  ];
}

function getEntityTableReferences(metadata: EntityMetadataLike[]) {
  return metadata.flatMap((entityMetadata) => {
    if (!entityMetadata.class) {
      return [];
    }

    return [
      {
        schemaName: normalizeSchemaName(entityMetadata.schema),
        tableName: getTableName(entityMetadata),
      },
    ];
  });
}

function dedupeTableReferences(tableReferences: TableReference[]) {
  return [
    ...new Map(
      tableReferences.map((table) => [
        `${table.schemaName}.${table.tableName}`,
        table,
      ]),
    ).values(),
  ];
}

function isPolicyDefinitionIntroduced(
  definition: RowLevelSecurityDefinition,
  upSql: string[],
) {
  return upSql.some((sql) => isCreateTableStatement(sql, definition));
}

function hasPolicyDefinition(
  definitions: RowLevelSecurityDefinition[],
  definition: RowLevelSecurityDefinition,
) {
  return definitions.some(
    (candidate) =>
      getPolicyDefinitionKey(candidate) === getPolicyDefinitionKey(definition),
  );
}

function sortPolicyDefinitions(definitions: RowLevelSecurityDefinition[]) {
  return [...definitions].sort((left, right) =>
    getPolicyDefinitionKey(left).localeCompare(getPolicyDefinitionKey(right)),
  );
}

function getPolicyDefinitionKey(definition: RowLevelSecurityDefinition) {
  return [
    definition.schemaName,
    definition.tableName,
    definition.policyName,
  ].join(".");
}

function createPolicyDefinitionFromPolicyRow(
  row: PolicyRow,
): RowLevelSecurityDefinition {
  return {
    entityName: `${row.schema_name}.${row.table_name}`,
    schemaName: row.schema_name,
    tableName: row.table_name,
    policyName: row.policy_name,
    mode:
      row.permissive === false ? PolicyMode.RESTRICTIVE : PolicyMode.PERMISSIVE,
    command: getPolicyCommandFromDatabase(row.command),
    using: row.qual ?? undefined,
    withCheck: row.with_check ?? undefined,
  };
}

function getPolicyCommandFromDatabase(command: string | null | undefined) {
  if (command === "r") {
    return PolicyCommand.SELECT;
  }

  if (command === "a") {
    return PolicyCommand.INSERT;
  }

  if (command === "w") {
    return PolicyCommand.UPDATE;
  }

  if (command === "d") {
    return PolicyCommand.DELETE;
  }

  return PolicyCommand.ALL;
}

function isCreateTableStatement(
  sql: string,
  definition: RowLevelSecurityDefinition,
) {
  return new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${createTableReferencePattern(
      definition,
    )}(?:\\s|\\()`,
    "i",
  ).test(sql);
}

function createTableReferencePattern(definition: RowLevelSecurityDefinition) {
  const table = `"${escapeRegExp(definition.tableName)}"`;

  if (definition.schemaName === "public") {
    return `(?:"public"\\.)?${table}`;
  }

  return `"${escapeRegExp(definition.schemaName)}"\\.${table}`;
}

function normalizeSchemaName(schemaName: string | undefined) {
  return !schemaName || schemaName === "*" ? "public" : schemaName;
}

function getTableName(entityMetadata: EntityMetadataLike) {
  const tableName = entityMetadata.tableName ?? entityMetadata.collection;

  if (!tableName) {
    throw new Error(
      `Policy entity ${getEntityName(entityMetadata)} does not have a table name`,
    );
  }

  return tableName;
}

function getEntityName(entityMetadata: EntityMetadataLike) {
  return (
    entityMetadata.class?.name ??
    entityMetadata.className ??
    entityMetadata.name ??
    "UnknownEntity"
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
