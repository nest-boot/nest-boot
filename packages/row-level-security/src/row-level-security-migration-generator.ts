import { createHash } from "node:crypto";

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
import { isPostgresKeywordRequiringQuote } from "./utils/is-postgres-keyword-requiring-quote";
import { normalizePostgresTypeAlias } from "./utils/normalize-postgres-type-alias";

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
  const normalized = expression?.trim();

  if (!normalized) {
    return "";
  }

  return normalizePostgresExpression(normalized);
}

function normalizePostgresExpression(expression: string) {
  const normalized = stripSelectProjectionAliases(
    mapSqlOutsideQuotedTokens(
      expression.replace(/'((?:''|[^'])*)'::text\b/gi, "'$1'"),
      normalizePostgresExpressionSegment,
    ).trim(),
  );

  return stripRedundantJsonOperandParentheses(
    stripRedundantOuterParentheses(
      stripRedundantCurrentSettingCastParentheses(normalized),
    ),
  );
}

function stripRedundantCurrentSettingCastParentheses(expression: string) {
  return expression.replace(
    /\((current_setting\('(?:''|[^'])*', true\))\)::/gi,
    "$1::",
  );
}

function normalizePostgresExpressionSegment(segment: string) {
  return normalizeSqlOperatorSpacing(
    normalizeNullTypeCasts(
      segment
        .replace(/\s+/g, " ")
        .replace(/\b(select|and|or|not|is|true|false|null|as)\b/gi, (match) =>
          match.toLowerCase(),
        )
        .replace(/\s*,\s*/g, ", "),
    ),
  )
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

function normalizeNullTypeCasts(segment: string) {
  return segment
    .replace(
      /\bnull::(?:character\s+varying|varchar)(?:\s*\([^)]*\))?/gi,
      "null::character varying",
    )
    .replace(
      /\bnull::(?:timestamp\s+with\s+time\s+zone|timestamptz)\b/gi,
      "null::timestamp with time zone",
    )
    .replace(
      /\bnull::([a-z_][a-z0-9_.]*)/gi,
      (_match, type: string) =>
        `null::${normalizePostgresTypeAlias(type.toLowerCase())}`,
    );
}

function normalizeSqlOperatorSpacing(segment: string) {
  const jsonOperators: string[] = [];
  const protectedSegment = segment.replace(
    /\s*(#>>|#>|->>|->|@>|<@)\s*/g,
    (_match, operator: string) => {
      const placeholder = `__rls_json_operator_${String(jsonOperators.length)}__`;
      jsonOperators.push(` ${operator} `);
      return placeholder;
    },
  );

  return protectedSegment
    .replace(
      /\s*(<>|!=|<=|>=|=|<|>)\s*/g,
      (_match, operator: string) => ` ${operator === "!=" ? "<>" : operator} `,
    )
    .replace(
      /__rls_json_operator_(\d+)__/g,
      (_match, index: string) => jsonOperators[Number(index)],
    );
}

function stripSelectProjectionAliases(expression: string) {
  let normalized = "";
  const selectDepths = new Set<number>();
  let depth = 0;
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (character === "'") {
      const literalEnd = readSqlStringLiteralEnd(expression, index);
      normalized += expression.slice(index, literalEnd);
      index = literalEnd;
      continue;
    }

    if (character === '"') {
      const identifierEnd = readQuotedIdentifierEnd(expression, index);
      normalized += expression.slice(index, identifierEnd);
      index = identifierEnd;
      continue;
    }

    if (character === "(") {
      depth += 1;
      normalized += character;
      index += 1;
      continue;
    }

    if (character === ")") {
      selectDepths.delete(depth);
      depth -= 1;
      normalized += character;
      index += 1;
      continue;
    }

    const wordEnd = readSqlWordEnd(expression, index);

    if (wordEnd > index) {
      const word = expression.slice(index, wordEnd);
      const lowerWord = word.toLowerCase();

      if (lowerWord === "select") {
        selectDepths.add(depth);
      }

      if (lowerWord === "as" && selectDepths.has(depth)) {
        const aliasEnd = readSelectProjectionAliasEnd(expression, wordEnd);

        if (aliasEnd !== undefined) {
          normalized = normalized.replace(/\s+$/, "");
          index = aliasEnd;
          continue;
        }
      }

      normalized += word;
      index = wordEnd;
      continue;
    }

    normalized += character;
    index += 1;
  }

  return normalized;
}

function readSelectProjectionAliasEnd(expression: string, startIndex: number) {
  const aliasStart = skipSqlWhitespace(expression, startIndex);
  const aliasEnd = readSqlIdentifierEnd(expression, aliasStart);

  if (aliasEnd === aliasStart) {
    return undefined;
  }

  const nextIndex = skipSqlWhitespace(expression, aliasEnd);

  return expression[nextIndex] === ")" ? nextIndex : undefined;
}

function stripRedundantOuterParentheses(expression: string) {
  let normalized = expression;

  while (isWrappedInParentheses(normalized)) {
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

function stripRedundantJsonOperandParentheses(expression: string) {
  let normalized = expression;
  let previous: string;

  do {
    previous = normalized;
    normalized = stripRedundantJsonOperandParenthesesOnce(normalized);
  } while (normalized !== previous);

  return normalized;
}

function stripRedundantJsonOperandParenthesesOnce(expression: string) {
  const removals = new Set<number>();
  const parenthesisPairs = findParenthesisPairs(expression);

  for (const [start, end] of parenthesisPairs) {
    const innerExpression = expression.slice(start + 1, end);

    if (
      hasTopLevelJsonOperator(innerExpression) &&
      (hasComparisonOperatorBefore(expression, start) ||
        hasComparisonOperatorAfter(expression, end))
    ) {
      removals.add(start);
      removals.add(end);
    }
  }

  if (removals.size === 0) {
    return expression;
  }

  return [...expression]
    .filter((_character, index) => !removals.has(index))
    .join("");
}

function isWrappedInParentheses(expression: string) {
  if (!expression.startsWith("(") || !expression.endsWith(")")) {
    return false;
  }

  let depth = 0;
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (character === "'") {
      index = readSqlStringLiteralEnd(expression, index);
      continue;
    }

    if (character === '"') {
      index = readQuotedIdentifierEnd(expression, index);
      continue;
    }

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;

      if (depth === 0 && index < expression.length - 1) {
        return false;
      }
    }

    if (depth < 0) {
      return false;
    }

    index += 1;
  }

  return depth === 0;
}

function findParenthesisPairs(expression: string) {
  const pairs: [number, number][] = [];
  const stack: number[] = [];
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (character === "'") {
      index = readSqlStringLiteralEnd(expression, index);
      continue;
    }

    if (character === '"') {
      index = readQuotedIdentifierEnd(expression, index);
      continue;
    }

    if (character === "(") {
      stack.push(index);
    } else if (character === ")") {
      const start = stack.pop();

      if (start !== undefined) {
        pairs.push([start, index]);
      }
    }

    index += 1;
  }

  return pairs;
}

function hasTopLevelJsonOperator(expression: string) {
  let depth = 0;
  let index = 0;

  while (index < expression.length) {
    const character = expression[index];

    if (character === "'") {
      index = readSqlStringLiteralEnd(expression, index);
      continue;
    }

    if (character === '"') {
      index = readQuotedIdentifierEnd(expression, index);
      continue;
    }

    if (character === "(") {
      depth += 1;
      index += 1;
      continue;
    }

    if (character === ")") {
      depth -= 1;
      index += 1;
      continue;
    }

    if (depth === 0) {
      const jsonOperator = readJsonOperatorAt(expression, index);

      if (jsonOperator) {
        return true;
      }
    }

    index += 1;
  }

  return false;
}

function hasComparisonOperatorBefore(expression: string, startIndex: number) {
  const operatorEnd =
    skipSqlWhitespaceBackwards(expression, startIndex - 1) + 1;

  return ["<>", "!=", "<=", ">=", "=", "<", ">"].some(
    (operator) =>
      expression.slice(operatorEnd - operator.length, operatorEnd) === operator,
  );
}

function hasComparisonOperatorAfter(expression: string, endIndex: number) {
  const operatorStart = skipSqlWhitespace(expression, endIndex + 1);

  return Boolean(readComparisonOperatorAt(expression, operatorStart));
}

function mapSqlOutsideQuotedTokens(
  expression: string,
  transform: (segment: string) => string,
) {
  const parts: string[] = [];
  let segmentStart = 0;
  let index = 0;

  while (index < expression.length) {
    if (expression[index] !== "'" && expression[index] !== '"') {
      index += 1;
      continue;
    }

    parts.push(transform(expression.slice(segmentStart, index)));

    if (expression[index] === "'") {
      const literalStart = index;
      index = readSqlStringLiteralEnd(expression, index);
      parts.push(expression.slice(literalStart, index));
    } else {
      const identifierStart = index;
      index = readQuotedIdentifierEnd(expression, index);
      parts.push(
        normalizeQuotedIdentifier(expression.slice(identifierStart, index)),
      );
    }

    segmentStart = index;
  }

  parts.push(transform(expression.slice(segmentStart)));

  return parts.join("");
}

function normalizeQuotedIdentifier(identifierToken: string) {
  const identifier = identifierToken.slice(1, -1).replace(/""/g, '"');

  if (
    /^[a-z_][a-z0-9_]*$/.test(identifier) &&
    !isPostgresKeywordRequiringQuote(identifier)
  ) {
    return identifier;
  }

  return identifierToken;
}

function readSqlStringLiteralEnd(expression: string, startIndex: number) {
  let index = startIndex + 1;

  while (index < expression.length) {
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

function readSqlIdentifierEnd(expression: string, startIndex: number) {
  if (expression[startIndex] === '"') {
    return readQuotedIdentifierEnd(expression, startIndex);
  }

  return readSqlWordEnd(expression, startIndex);
}

function readJsonOperatorAt(expression: string, startIndex: number) {
  return ["#>>", "->>", "#>", "->", "@>", "<@"].find((operator) =>
    expression.startsWith(operator, startIndex),
  );
}

function readComparisonOperatorAt(expression: string, startIndex: number) {
  return ["<>", "!=", "<=", ">=", "=", "<", ">"].find((operator) =>
    expression.startsWith(operator, startIndex),
  );
}

function readSqlWordEnd(expression: string, startIndex: number) {
  if (!/[a-z_]/i.test(expression[startIndex] ?? "")) {
    return startIndex;
  }

  let index = startIndex + 1;

  while (/[a-z0-9_$]/i.test(expression[index] ?? "")) {
    index += 1;
  }

  return index;
}

function skipSqlWhitespace(expression: string, startIndex: number) {
  let index = startIndex;

  while (/\s/.test(expression[index] ?? "")) {
    index += 1;
  }

  return index;
}

function skipSqlWhitespaceBackwards(expression: string, startIndex: number) {
  let index = startIndex;

  while (/\s/.test(expression[index] ?? "")) {
    index -= 1;
  }

  return index;
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
