import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";
import type {
  PolicyEntityMetadata,
  PolicyMetadata,
  PolicyMetadataEntry,
} from "../interfaces/policy-metadata.interface";
import type { PolicyOptions } from "../interfaces/policy-options.interface";
import { assertIdentifier } from "../utils/assert-identifier";
import { escapeSqlLiteral } from "../utils/escape-sql-literal";
import { isPostgresKeywordRequiringQuote } from "../utils/is-postgres-keyword-requiring-quote";
import { normalizePostgresTypeAlias } from "../utils/normalize-postgres-type-alias";
import { quoteIdentifier } from "../utils/quote-identifier";

export type {
  PolicyEntityMetadata,
  PolicyEntityPropertyMetadata,
  PolicyEntityTargetMetadata,
  PolicyMetadata,
  PolicyMetadataEntry,
  PolicyMetadataFactory,
} from "../interfaces/policy-metadata.interface";
export type { PolicyOptions } from "../interfaces/policy-options.interface";

const policyMetadata = new WeakMap<object, PolicyMetadataEntry[]>();

/**
 * Attaches PostgreSQL row-level security policy metadata to an entity class.
 *
 * When `property` and `context` are provided, the decorator derives default
 * `USING` and `WITH CHECK` expressions that compare the mapped database column
 * against a transaction-local PostgreSQL setting read via `current_setting`.
 */
export function Policy(options: PolicyOptions): ClassDecorator {
  const name = normalizeOption(options.name, "Policy name is required");
  const command = options.command ?? PolicyCommand.ALL;
  const property = normalizeOption(
    options.property,
    "Policy property is required",
  );
  const context = normalizeOption(
    options.context,
    "Policy context is required",
  );
  const using = normalizeExpression(options.using);
  const withCheck = normalizeExpression(options.withCheck);
  const generatedExpressionContext =
    property && context ? { property, context } : undefined;
  const hasGeneratedExpression = Boolean(generatedExpressionContext);

  assertPolicyContextOptions(property, context);
  assertPolicyPredicates(command, using, withCheck, hasGeneratedExpression);

  return (target) => {
    const roles = options.roles ?? [];
    const metadata = {
      mode: options.mode ?? PolicyMode.PERMISSIVE,
      command,
      roles,
    };
    const createPolicyDefinition = (entityMetadata: PolicyEntityMetadata) => ({
      name:
        name ??
        createDefaultPolicyName(entityMetadata, command, property, roles),
      ...metadata,
      ...(generatedExpressionContext
        ? getGeneratedPolicyPredicates(
            command,
            createPolicyContextExpression(
              entityMetadata,
              generatedExpressionContext.property,
              generatedExpressionContext.context,
            ),
          )
        : {}),
      ...(using ? { using } : {}),
      ...(withCheck ? { withCheck } : {}),
    });

    addPolicyMetadata(
      target,
      !name || hasGeneratedExpression
        ? createPolicyDefinition
        : {
            name,
            ...metadata,
            ...(using ? { using } : {}),
            ...(withCheck ? { withCheck } : {}),
          },
    );
  };
}

/** Returns static policy metadata entries already attached to a class. */
export function getPolicyMetadata(target: object) {
  return getPolicyMetadataEntries(target).filter(isPolicyMetadata);
}

/** Resolves all policy metadata entries for a class using concrete entity metadata. */
export function getPolicyDefinitions(
  target: object,
  entityMetadata: PolicyEntityMetadata,
) {
  return getPolicyMetadataEntries(target).map((metadata) =>
    typeof metadata === "function" ? metadata(entityMetadata) : metadata,
  );
}

/** Adds a raw policy metadata entry to a class. */
export function addPolicyMetadata(
  target: object,
  metadata: PolicyMetadataEntry,
) {
  policyMetadata.set(target, [...getPolicyMetadataEntries(target), metadata]);
}

function normalizeExpression(expression: string | undefined) {
  const normalized = expression?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
}

function normalizeOption(value: string | undefined, emptyMessage: string) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(emptyMessage);
  }

  return normalized;
}

function assertPolicyContextOptions(
  property: string | undefined,
  context: string | undefined,
) {
  if (Boolean(property) !== Boolean(context)) {
    throw new Error("Policy property and context must be provided together");
  }
}

function assertPolicyPredicates(
  command: PolicyCommand,
  using: string | undefined,
  withCheck: string | undefined,
  hasGeneratedExpression: boolean,
) {
  const hasUsing =
    Boolean(using) ||
    (hasGeneratedExpression && command !== PolicyCommand.INSERT);
  const hasWithCheck =
    Boolean(withCheck) ||
    (hasGeneratedExpression &&
      command !== PolicyCommand.SELECT &&
      command !== PolicyCommand.DELETE);

  if (command === PolicyCommand.SELECT || command === PolicyCommand.DELETE) {
    if (!hasUsing) {
      throw new Error("Policy using expression is required");
    }

    if (withCheck) {
      throw new Error(`Policy withCheck is not allowed for ${command}`);
    }

    return;
  }

  if (command === PolicyCommand.INSERT) {
    if (using) {
      throw new Error("Policy using is not allowed for insert");
    }

    if (!hasWithCheck) {
      throw new Error("Policy withCheck expression is required");
    }

    return;
  }

  if (!hasUsing && !hasWithCheck) {
    throw new Error("Policy using or withCheck expression is required");
  }
}

function getGeneratedPolicyPredicates(
  command: PolicyCommand,
  expression: string,
) {
  if (command === PolicyCommand.SELECT || command === PolicyCommand.DELETE) {
    return { using: expression };
  }

  if (command === PolicyCommand.INSERT) {
    return { withCheck: expression };
  }

  return {
    using: expression,
    withCheck: expression,
  };
}

function createDefaultPolicyName(
  entityMetadata: PolicyEntityMetadata,
  command: PolicyCommand,
  propertyName: string | undefined,
  roles: string[],
) {
  return [
    entityMetadata.tableName,
    propertyName,
    command,
    ...[...roles].sort(),
    "policy",
  ]
    .filter(Boolean)
    .map((part) => toSnakeCaseIdentifier(String(part)))
    .join("_");
}

function toSnakeCaseIdentifier(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function createPolicyContextExpression(
  entityMetadata: PolicyEntityMetadata,
  propertyName: string,
  contextName: string,
) {
  const property = getPropertyMetadata(entityMetadata, propertyName);
  const columnName = getPropertyColumnName(
    entityMetadata,
    propertyName,
    property,
  );
  const contextType = getPropertyContextType(
    entityMetadata,
    propertyName,
    property,
  );

  return `((select current_setting('app.${escapeSqlLiteral(contextName)}', true)::${contextType}) = ${formatDeparsedIdentifier(columnName)})`;
}

function formatDeparsedIdentifier(identifier: string) {
  assertIdentifier(identifier);

  if (
    /^[a-z_][a-z0-9_]*$/.test(identifier) &&
    !isPostgresKeywordRequiringQuote(identifier)
  ) {
    return identifier;
  }

  return quoteIdentifier(identifier);
}

function getPropertyMetadata(
  entityMetadata: PolicyEntityMetadata,
  propertyName: string,
) {
  const property = entityMetadata.properties?.[propertyName];

  if (!property) {
    throw new Error(
      `Policy property "${propertyName}" was not found on entity ${entityMetadata.entityName}`,
    );
  }

  return property;
}

function getPropertyColumnName(
  entityMetadata: PolicyEntityMetadata,
  propertyName: string,
  property: NonNullable<PolicyEntityMetadata["properties"]>[string],
) {
  const fieldNames = property.fieldNames ?? [];
  const columnName = property.fieldName ?? fieldNames[0];

  if (!columnName || fieldNames.length > 1) {
    throw new Error(
      `Policy property "${propertyName}" on entity ${entityMetadata.entityName} must resolve to exactly one database column`,
    );
  }

  return columnName;
}

function getPropertyContextType(
  entityMetadata: PolicyEntityMetadata,
  propertyName: string,
  property: NonNullable<PolicyEntityMetadata["properties"]>[string],
) {
  const targetPrimaryKeyProperty = getTargetPrimaryKeyProperty(
    entityMetadata,
    propertyName,
    property,
  );

  if (targetPrimaryKeyProperty) {
    return getSinglePropertyContextType(
      entityMetadata,
      propertyName,
      targetPrimaryKeyProperty,
    );
  }

  return getSinglePropertyContextType(entityMetadata, propertyName, property);
}

function getTargetPrimaryKeyProperty(
  entityMetadata: PolicyEntityMetadata,
  propertyName: string,
  property: NonNullable<PolicyEntityMetadata["properties"]>[string],
) {
  const targetMeta = property.targetMeta;

  if (!targetMeta) {
    return undefined;
  }

  const primaryKeys =
    targetMeta.primaryKeys ??
    Object.entries(targetMeta.properties ?? {})
      .filter(([, targetProperty]) => targetProperty.primary)
      .map(([targetPropertyName]) => targetPropertyName);

  if (primaryKeys.length !== 1) {
    throw new Error(
      `Policy property "${propertyName}" on entity ${entityMetadata.entityName} must target an entity with exactly one primary key`,
    );
  }

  const primaryKeyProperty = targetMeta.properties?.[primaryKeys[0]];

  if (!primaryKeyProperty) {
    throw new Error(
      `Policy property "${propertyName}" on entity ${entityMetadata.entityName} must expose target primary key metadata`,
    );
  }

  return primaryKeyProperty;
}

function getSinglePropertyContextType(
  entityMetadata: PolicyEntityMetadata,
  propertyName: string,
  property: NonNullable<PolicyEntityMetadata["properties"]>[string],
) {
  const columnTypes = property.columnTypes ?? [];
  const columnType = columnTypes[0]?.trim();

  if (columnTypes.length > 1) {
    throw new Error(
      `Policy property "${propertyName}" on entity ${entityMetadata.entityName} must resolve to exactly one database column type`,
    );
  }

  if (columnType) {
    return normalizePostgresType(entityMetadata, propertyName, columnType);
  }

  const inferredType =
    mapPropertyTypeToPostgresType(property.type) ??
    mapPropertyTypeToPostgresType(property.runtimeType);

  if (inferredType) {
    return inferredType;
  }

  throw new Error(
    `Policy property "${propertyName}" on entity ${entityMetadata.entityName} must expose a database column type`,
  );
}

function normalizePostgresType(
  entityMetadata: PolicyEntityMetadata,
  propertyName: string,
  postgresType: string,
) {
  const normalized = postgresType.trim().replace(/\s+/g, " ");

  if (!/^[A-Za-z0-9_."()[\],\s[\]]+$/.test(normalized)) {
    throw new Error(
      `Policy property "${propertyName}" on entity ${entityMetadata.entityName} has an unsupported database column type: ${postgresType}`,
    );
  }

  return normalizePostgresTypeAlias(normalized);
}

function mapPropertyTypeToPostgresType(propertyType: string | undefined) {
  const normalized = propertyType?.trim().toLowerCase();

  switch (normalized) {
    case "bigint":
    case "biginttype":
      return "bigint";
    case "boolean":
    case "booleantype":
      return "boolean";
    case "date":
    case "datetime":
    case "datetimetype":
      return "timestamp with time zone";
    case "int":
    case "integer":
    case "number":
    case "numbertype":
      return "integer";
    case "string":
    case "stringtype":
    case "text":
    case "texttype":
      return "text";
    case "uuid":
    case "uuidtype":
      return "uuid";
    default:
      return undefined;
  }
}

function getPolicyMetadataEntries(target: object) {
  return policyMetadata.get(target) ?? [];
}

function isPolicyMetadata(
  metadata: PolicyMetadataEntry,
): metadata is PolicyMetadata {
  return typeof metadata !== "function";
}
