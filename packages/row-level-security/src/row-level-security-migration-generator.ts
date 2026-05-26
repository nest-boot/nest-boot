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
import { createPolicyPrivilegeDownSqlStatements } from "./utils/create-policy-privilege-down-sql-statements";
import {
  createPolicyRoleDownSqlStatements,
  createPolicyRoleUpSqlStatements,
  getPolicyRoleNames,
} from "./utils/create-policy-role-sql-statements";
import { createPolicyUpSqlStatements } from "./utils/create-policy-up-sql-statements";

/** MikroORM TypeScript migration generator that injects generated RLS SQL. */
export class RowLevelSecurityMigrationGenerator extends TSMigrationGenerator {
  private existingPolicyDefinitions?: RowLevelSecurityDefinition[];
  private existingPolicyRoleDefinitions?: RowLevelSecurityDefinition[];
  private currentPolicyDefinitions?: RowLevelSecurityDefinition[];

  override async generate(
    diff: MigrationDiff,
    path?: string,
    name?: string,
  ): Promise<[string, string]> {
    const entityMetadata = this.getEntityMetadata();
    const currentPolicyDefinitions = this.getPolicyDefinitions(entityMetadata);
    const tableReferences = getPolicyDefinitionTableReferences(
      currentPolicyDefinitions,
    );

    const existingPolicyDefinitions =
      await this.getExistingPolicyDefinitionsFromDatabase(tableReferences);

    this.existingPolicyDefinitions = existingPolicyDefinitions
      ? filterPolicyDefinitionsByTableReferences(
          existingPolicyDefinitions,
          tableReferences,
        )
      : undefined;
    this.existingPolicyRoleDefinitions = existingPolicyDefinitions;
    this.currentPolicyDefinitions = currentPolicyDefinitions;

    try {
      return await super.generate(diff, path, name);
    } finally {
      this.existingPolicyDefinitions = undefined;
      this.existingPolicyRoleDefinitions = undefined;
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
    const preservedDefinitions = this.existingPolicyDefinitions ?? [];
    const preservedRoleDefinitions =
      this.existingPolicyRoleDefinitions ?? preservedDefinitions;
    const revocableRoleNames = getRevocableDefinitionRoleNames(
      added,
      preservedRoleDefinitions,
    );

    if (added.length === 0 && removed.length === 0) {
      return super.generateMigrationFile(className, diff);
    }

    const policyDiff = {
      up: [
        ...removed.map((definition) => createPolicyDownSql(definition)),
        ...diff.up,
        ...(added.length > 0 ? createPolicyBootstrapSqlStatements() : []),
        ...(added.length > 0
          ? createPolicyRoleUpSqlStatements(getDefinitionRoles(added))
          : []),
        ...getDefinitionBootstrapSql(added),
        ...added.flatMap((definition) =>
          createPolicyUpSqlStatements(definition),
        ),
      ],
      down: [
        ...added.map((definition) => createPolicyDownSql(definition)),
        ...added.flatMap((definition) =>
          createPolicyPrivilegeDownSqlStatements(
            definition,
            preservedDefinitions,
          ),
        ),
        ...(revocableRoleNames.length > 0
          ? createPolicyRoleDownSqlStatements(revocableRoleNames)
          : []),
        ...diff.down,
        ...(removed.length > 0 ? createPolicyBootstrapSqlStatements() : []),
        ...(removed.length > 0
          ? createPolicyRoleUpSqlStatements(getDefinitionRoles(removed))
          : []),
        ...getDefinitionBootstrapSql(removed),
        ...removed.flatMap((definition) =>
          createPolicyUpSqlStatements(definition),
        ),
      ],
    };

    const migrationFile = super.generateMigrationFile(className, policyDiff);

    return convertMigrationBaseClass(migrationFile);
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
          !hasPolicyDefinitionWithSameContent(
            existingPolicyDefinitions,
            definition,
          ) || isPolicyDefinitionIntroduced(definition, diff.up),
      ),
      removed: existingPolicyDefinitions.filter(
        (definition) =>
          !hasPolicyDefinitionWithSameContent(
            currentPolicyDefinitions,
            definition,
          ),
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
  ): Promise<RowLevelSecurityDefinition[] | undefined> {
    if (tableReferences.length === 0) {
      return [];
    }

    const driver = this
      .driver as unknown as RowLevelSecurityMigrationGeneratorDriverLike;
    const connection = driver.getConnection?.();

    if (!connection) {
      return undefined;
    }

    const rows = await connection.execute<PolicyRow[]>(/* SQL */ `
      SELECT
        p.polname AS policy_name,
        n.nspname AS schema_name,
        c.relname AS table_name,
        p.polpermissive AS permissive,
        p.polcmd AS command,
        pg_get_expr(p.polqual, p.polrelid) AS qual,
        pg_get_expr(p.polwithcheck, p.polrelid) AS with_check,
        ARRAY(
          SELECT roles.rolname
          FROM unnest(p.polroles) policy_role(role_oid)
          INNER JOIN pg_roles roles ON roles.oid = policy_role.role_oid
          WHERE policy_role.role_oid <> 0
          ORDER BY roles.rolname
        ) AS roles
      FROM pg_policy p
      INNER JOIN pg_class c ON c.oid = p.polrelid
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      ORDER BY n.nspname, c.relname
    `);

    return sortPolicyDefinitions(rows.map(createPolicyDefinitionFromPolicyRow));
  }
}

function convertMigrationBaseClass(migrationFile: string) {
  const migrationImport = "import { Migration } from '@mikro-orm/migrations';";
  const migrationBaseClass = "extends Migration";

  if (
    !migrationFile.includes(migrationImport) ||
    !migrationFile.includes(migrationBaseClass)
  ) {
    throw new Error("MikroORM migration output format is not supported");
  }

  return migrationFile
    .replace(
      migrationImport,
      "import { RowLevelSecurityMigration } from '@nest-boot/row-level-security';",
    )
    .replace(migrationBaseClass, "extends RowLevelSecurityMigration");
}

function getDefinitionBootstrapSql(definitions: RowLevelSecurityDefinition[]) {
  return [
    ...new Set(
      definitions.flatMap((definition) => definition.bootstrapSql ?? []),
    ),
  ];
}

function getDefinitionRoles(definitions: RowLevelSecurityDefinition[]) {
  return definitions.flatMap((definition) => definition.roles ?? []);
}

function getDefinitionRoleNames(definitions: RowLevelSecurityDefinition[]) {
  if (definitions.length === 0) {
    return [];
  }

  return getPolicyRoleNames(getDefinitionRoles(definitions));
}

function getRevocableDefinitionRoleNames(
  addedDefinitions: RowLevelSecurityDefinition[],
  preservedDefinitions: RowLevelSecurityDefinition[],
) {
  const preservedRoleNames = new Set(
    getDefinitionRoleNames(preservedDefinitions),
  );

  return getDefinitionRoleNames(addedDefinitions).filter(
    (role) => !preservedRoleNames.has(role),
  );
}

function getPolicyDefinitionTableReferences(
  definitions: RowLevelSecurityDefinition[],
) {
  return definitions.map((definition) => ({
    schemaName: definition.schemaName,
    tableName: definition.tableName,
  }));
}

function filterPolicyDefinitionsByTableReferences(
  definitions: RowLevelSecurityDefinition[],
  tableReferences: TableReference[],
) {
  const tableKeys = new Set(
    dedupeTableReferences(tableReferences).map(
      (table) => `${table.schemaName}.${table.tableName}`,
    ),
  );

  return definitions.filter((definition) =>
    tableKeys.has(`${definition.schemaName}.${definition.tableName}`),
  );
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

function hasPolicyDefinitionWithSameContent(
  definitions: RowLevelSecurityDefinition[],
  definition: RowLevelSecurityDefinition,
) {
  return definitions.some(
    (candidate) =>
      getPolicyDefinitionKey(candidate) ===
        getPolicyDefinitionKey(definition) &&
      hasSamePolicyDefinitionContent(candidate, definition),
  );
}

function hasSamePolicyDefinitionContent(
  left: RowLevelSecurityDefinition,
  right: RowLevelSecurityDefinition,
) {
  return (
    normalizePolicyMode(left.mode) === normalizePolicyMode(right.mode) &&
    normalizePolicyCommand(left.command) ===
      normalizePolicyCommand(right.command) &&
    normalizePolicyExpression(left.using) ===
      normalizePolicyExpression(right.using) &&
    normalizePolicyExpression(left.withCheck) ===
      normalizePolicyExpression(right.withCheck) &&
    normalizePolicyRoles(left.roles).join("\n") ===
      normalizePolicyRoles(right.roles).join("\n")
  );
}

function normalizePolicyMode(mode: PolicyMode | undefined) {
  return mode ?? PolicyMode.PERMISSIVE;
}

function normalizePolicyCommand(command: PolicyCommand | undefined) {
  return command ?? PolicyCommand.ALL;
}

function normalizePolicyExpression(expression: string | undefined) {
  return expression?.trim() ?? "";
}

function normalizePolicyRoles(roles: string[] | undefined) {
  return [
    ...new Set((roles ?? []).filter((role) => role.toLowerCase() !== "public")),
  ].sort();
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
    roles: normalizePolicyRowRoles(row.roles),
  };
}

function normalizePolicyRowRoles(roles: PolicyRow["roles"]) {
  if (!roles) {
    return [];
  }

  if (Array.isArray(roles)) {
    return normalizePolicyRoles(roles);
  }

  return normalizePolicyRoles(
    roles
      .replace(/^{|}$/g, "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean),
  );
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
