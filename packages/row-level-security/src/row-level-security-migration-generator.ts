import { createHash } from "node:crypto";

import { TSMigrationGenerator } from "@mikro-orm/migrations";
import type { Expr, SelectStatement } from "pgsql-ast-parser";
import { parse } from "pgsql-ast-parser";

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
import { normalizePostgresTypeAlias } from "./utils/normalize-postgres-type-alias.util";

const POSTGRES_IDENTIFIER_MAX_LENGTH = 63;
const POLICY_IDENTIFIER_TYPE = "policy";

type HashAlgorithm = "md5" | "sha256";

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
    return await this.withPolicyDefinitions(diff, () =>
      super.generate(diff, path, name),
    );
  }

  /** Returns whether the current metadata contains RLS policy changes not present in the database. */
  async hasPendingPolicyChanges(diff: MigrationDiff): Promise<boolean> {
    return await this.withPolicyDefinitions(diff, () => {
      if (!this.existingPolicyDefinitions) {
        return false;
      }

      const currentPolicyDefinitions = this.currentPolicyDefinitions ?? [];
      const { added, removed } = this.getPolicyDefinitionChanges(
        diff,
        currentPolicyDefinitions,
      );

      return added.length > 0 || removed.length > 0;
    });
  }

  private async withPolicyDefinitions<T>(
    diff: MigrationDiff,
    callback: () => Promise<T> | T,
  ): Promise<T> {
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
      return await callback();
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
    const hashAlgorithm = this.getHashAlgorithm();

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
        ).map((policy) => {
          const policyName = normalizePostgresPolicyName(
            policy.name,
            hashAlgorithm,
          );

          return {
            entityName,
            schemaName,
            tableName,
            policyName,
            policyNameAliases: createPolicyNameAliases(policy.name, policyName),
            mode: policy.mode,
            command: policy.command,
            using: policy.using,
            withCheck: policy.withCheck,
            roles: policy.roles,
            bootstrapSql: policy.bootstrapSql,
          };
        });
      }),
    );
  }

  private getHashAlgorithm(): HashAlgorithm {
    const driver = this
      .driver as unknown as RowLevelSecurityMigrationGeneratorDriverLike;
    const hashAlgorithm = driver.config?.get?.("hashAlgorithm");

    return hashAlgorithm === "md5" ? "md5" : "sha256";
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
      hasSamePolicyDefinitionIdentity(candidate, definition) &&
      hasSamePolicyDefinitionContent(candidate, definition),
  );
}

function hasSamePolicyDefinitionIdentity(
  left: RowLevelSecurityDefinition,
  right: RowLevelSecurityDefinition,
) {
  return (
    left.schemaName === right.schemaName &&
    left.tableName === right.tableName &&
    hasOverlappingPolicyNames(left, right)
  );
}

function hasOverlappingPolicyNames(
  left: RowLevelSecurityDefinition,
  right: RowLevelSecurityDefinition,
) {
  const leftNames = new Set(getPolicyNameAliases(left));

  return getPolicyNameAliases(right).some((name) => leftNames.has(name));
}

function getPolicyNameAliases(definition: RowLevelSecurityDefinition) {
  return definition.policyNameAliases ?? [definition.policyName];
}

function hasSamePolicyDefinitionContent(
  left: RowLevelSecurityDefinition,
  right: RowLevelSecurityDefinition,
) {
  return (
    normalizePolicyMode(left.mode) === normalizePolicyMode(right.mode) &&
    normalizePolicyCommand(left.command) ===
      normalizePolicyCommand(right.command) &&
    hasSamePolicyExpression(left.using, right.using) &&
    hasSamePolicyExpression(left.withCheck, right.withCheck) &&
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

function hasSamePolicyExpression(
  left: string | undefined,
  right: string | undefined,
) {
  const normalizedLeft = normalizePolicyExpression(left);
  const normalizedRight = normalizePolicyExpression(right);

  if (normalizedLeft !== undefined && normalizedRight !== undefined) {
    return normalizedLeft === normalizedRight;
  }

  if (normalizedLeft === undefined && normalizedRight === undefined) {
    return left?.trim() === right?.trim();
  }

  return false;
}

function normalizePolicyExpression(expression: string | undefined) {
  const normalized = expression?.trim();

  if (!normalized) {
    return "";
  }

  return normalizePostgresExpression(normalized);
}

function normalizePostgresExpression(expression: string) {
  const parsed = parsePolicyExpressionAst(expression);

  if (!parsed) {
    return undefined;
  }

  return JSON.stringify(
    canonicalizePolicyExpressionAst(parsed.ast, parsed.sql),
  );
}

function parsePolicyExpressionAst(expression: string) {
  const parsed = parsePolicyExpressionStatement(expression);

  if (parsed?.statement.type !== "select" || !parsed.statement.where) {
    return undefined;
  }

  return {
    ast: parsed.statement.where,
    sql: parsed.sql,
  };
}

function parsePolicyExpressionStatement(expression: string) {
  const sql = `select 1 where ${expression}`;

  try {
    return {
      sql,
      statement: parse(sql, { locationTracking: true })[0] as SelectStatement,
    };
  } catch {
    const parserCompatibleExpression =
      getPolicyExpressionForAstParser(expression);

    if (parserCompatibleExpression !== expression) {
      try {
        const parserCompatibleSql = `select 1 where ${parserCompatibleExpression}`;

        return {
          sql: parserCompatibleSql,
          statement: parse(parserCompatibleSql, {
            locationTracking: true,
          })[0] as SelectStatement,
        };
      } catch {
        return undefined;
      }
    }

    return undefined;
  }
}

function getPolicyExpressionForAstParser(expression: string) {
  // pgsql-ast-parser treats these multi-word casts in select projections as ambiguous.
  return replaceSqlOutsideQuotedTokens(expression, (segment) =>
    segment
      .replace(/::\s*character\s+varying\b/gi, "::varchar")
      .replace(/::\s*bit\s+varying\b/gi, "::varbit"),
  );
}

function replaceSqlOutsideQuotedTokens(
  expression: string,
  transform: (segment: string) => string,
) {
  const parts: string[] = [];
  let segmentStart = 0;
  let index = 0;

  while (index < expression.length) {
    const tokenEnd = readSqlQuotedTokenEnd(expression, index);

    if (tokenEnd === undefined) {
      index += 1;
      continue;
    }

    parts.push(transform(expression.slice(segmentStart, index)));
    parts.push(expression.slice(index, tokenEnd));
    segmentStart = tokenEnd;
    index = tokenEnd;
  }

  parts.push(transform(expression.slice(segmentStart)));

  return parts.join("");
}

function readSqlQuotedTokenEnd(expression: string, startIndex: number) {
  if (expression[startIndex] === "'") {
    return readSqlStringLiteralEnd(
      expression,
      startIndex,
      hasPostgresEscapeStringPrefix(expression, startIndex),
    );
  }

  if (expression[startIndex] === '"') {
    return readQuotedIdentifierEnd(expression, startIndex);
  }

  return readDollarQuotedStringEnd(expression, startIndex);
}

function hasPostgresEscapeStringPrefix(expression: string, quoteIndex: number) {
  const prefixIndex = quoteIndex - 1;

  if (!/[eE]/.test(expression[prefixIndex] ?? "")) {
    return false;
  }

  return prefixIndex === 0 || !isSqlIdentifierPart(expression[prefixIndex - 1]);
}

function readSqlStringLiteralEnd(
  expression: string,
  startIndex: number,
  allowBackslashEscapes = false,
) {
  let index = startIndex + 1;

  while (index < expression.length) {
    if (allowBackslashEscapes && expression[index] === "\\") {
      index += 2;
      continue;
    }

    if (expression[index] !== "'") {
      index += 1;
      continue;
    }

    if (expression[index + 1] === "'") {
      index += 2;
      continue;
    }

    index += 1;
    break;
  }

  return index;
}

function isSqlIdentifierPart(character: string | undefined) {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

function readQuotedIdentifierEnd(expression: string, startIndex: number) {
  let index = startIndex + 1;

  while (index < expression.length) {
    if (expression[index] !== '"') {
      index += 1;
      continue;
    }

    if (expression[index + 1] === '"') {
      index += 2;
      continue;
    }

    index += 1;
    break;
  }

  return index;
}

function readDollarQuotedStringEnd(expression: string, startIndex: number) {
  const delimiter = /^\$[a-z_][a-z0-9_]*\$|^\$\$/i.exec(
    expression.slice(startIndex),
  )?.[0];

  if (!delimiter) {
    return undefined;
  }

  const endIndex = expression.indexOf(delimiter, startIndex + delimiter.length);

  return endIndex === -1 ? expression.length : endIndex + delimiter.length;
}

type CanonicalPolicyExpressionAst =
  | string
  | number
  | boolean
  | null
  | CanonicalPolicyExpressionAst[]
  | { [key: string]: CanonicalPolicyExpressionAst };

function canonicalizePolicyExpressionAst(
  value: unknown,
  sourceSql: string,
): CanonicalPolicyExpressionAst {
  if (value === null || typeof value !== "object") {
    return value === undefined
      ? null
      : (value as string | number | boolean | null);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      canonicalizePolicyExpressionAst(item, sourceSql),
    );
  }

  if (isRedundantTextCast(value)) {
    return canonicalizePolicyExpressionAst(value.operand, sourceSql);
  }

  const node = value as Record<string, unknown>;
  const entries: [string, CanonicalPolicyExpressionAst][] = [];

  for (const key of Object.keys(node).sort()) {
    const property = node[key];

    if (property === undefined || key === "_location") {
      continue;
    }

    if (key === "alias" && "expr" in node) {
      continue;
    }

    if (key === "value" && isNumericPolicyExpressionAstNode(node)) {
      entries.push([
        key,
        getPolicyExpressionAstNodeSource(node, sourceSql) ??
          canonicalizePolicyExpressionAst(property, sourceSql),
      ]);
      continue;
    }

    if (key === "op" && typeof property === "string") {
      entries.push([key, normalizePolicyExpressionOperator(property)]);
      continue;
    }

    if (key === "to" && node.type === "cast") {
      entries.push([
        key,
        canonicalizePolicyExpressionDataType(property, sourceSql),
      ]);
      continue;
    }

    entries.push([key, canonicalizePolicyExpressionAst(property, sourceSql)]);
  }

  return Object.fromEntries(entries);
}

function canonicalizePolicyExpressionDataType(
  value: unknown,
  sourceSql: string,
): CanonicalPolicyExpressionAst {
  if (value === null || typeof value !== "object") {
    return value === undefined
      ? null
      : (value as string | number | boolean | null);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      canonicalizePolicyExpressionDataType(item, sourceSql),
    );
  }

  const node = value as Record<string, unknown>;
  const entries: [string, CanonicalPolicyExpressionAst][] = [];
  const isDoubleQuoted = node.doubleQuoted === true;

  for (const key of Object.keys(node).sort()) {
    const property = node[key];

    if (property === undefined || key === "_location") {
      continue;
    }

    if (key === "name" && typeof property === "string" && !isDoubleQuoted) {
      entries.push([key, normalizePolicyExpressionDataTypeName(property)]);
      continue;
    }

    if (key === "arrayOf") {
      entries.push([
        key,
        canonicalizePolicyExpressionDataType(property, sourceSql),
      ]);
      continue;
    }

    entries.push([key, canonicalizePolicyExpressionAst(property, sourceSql)]);
  }

  return Object.fromEntries(entries);
}

function isRedundantTextCast(
  value: object,
): value is Expr & { type: "cast"; operand: Expr } {
  if (!isPolicyExpressionAstNode(value, "cast") || !isTextType(value.to)) {
    return false;
  }

  return (
    isPolicyExpressionAstNode(value.operand, "string") ||
    isTextJsonMember(value.operand)
  );
}

function isTextJsonMember(value: unknown) {
  return isPolicyExpressionAstNode(value, "member") && value.op === "->>";
}

function isTextType(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const node = value as Record<string, unknown>;
  const typeName = node.name;

  return (
    node.doubleQuoted !== true &&
    typeof typeName === "string" &&
    normalizePolicyExpressionDataTypeName(typeName) === "text"
  );
}

function isNumericPolicyExpressionAstNode(value: Record<string, unknown>) {
  return value.type === "integer" || value.type === "numeric";
}

function getPolicyExpressionAstNodeSource(
  value: Record<string, unknown>,
  sourceSql: string,
) {
  const location = value._location;

  if (
    location === null ||
    typeof location !== "object" ||
    Array.isArray(location)
  ) {
    return undefined;
  }

  const start = (location as Record<string, unknown>).start;
  const end = (location as Record<string, unknown>).end;

  if (typeof start !== "number" || typeof end !== "number") {
    return undefined;
  }

  return sourceSql.slice(start, end);
}

function isPolicyExpressionAstNode<TType extends string>(
  value: unknown,
  type: TType,
): value is Record<string, unknown> & { type: TType } {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).type === type
  );
}

function normalizePolicyExpressionDataTypeName(typeName: string) {
  return normalizePostgresTypeAlias(
    typeName.toLowerCase().replace(/\s+/g, " "),
  );
}

function normalizePolicyExpressionOperator(operator: string) {
  return operator === "!=" ? "<>" : operator;
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

function normalizePostgresPolicyName(
  policyName: string,
  hashAlgorithm: HashAlgorithm,
) {
  if (policyName.length <= POSTGRES_IDENTIFIER_MAX_LENGTH) {
    return policyName;
  }

  return [
    policyName.substring(0, 55 - POLICY_IDENTIFIER_TYPE.length),
    hashValue(policyName, 5, hashAlgorithm),
    POLICY_IDENTIFIER_TYPE,
  ].join("_");
}

function createPolicyNameAliases(policyName: string, normalizedName: string) {
  const aliases = new Set([normalizedName]);

  if (policyName.length > POSTGRES_IDENTIFIER_MAX_LENGTH) {
    aliases.add(policyName.substring(0, POSTGRES_IDENTIFIER_MAX_LENGTH));
  }

  return [...aliases];
}

function hashValue(
  value: string,
  length: number,
  hashAlgorithm: HashAlgorithm,
) {
  return createHash(hashAlgorithm)
    .update(value)
    .digest("hex")
    .substring(0, length);
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
