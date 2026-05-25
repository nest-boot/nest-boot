import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";
import type { PolicySqlOptions } from "../interfaces/policy-sql-options.interface";
import { assertIdentifier } from "./assert-identifier";
import { quoteQualifiedIdentifier } from "./quote-qualified-identifier";

export function createPolicyUpSqlStatements(options: PolicySqlOptions) {
  const tableIdentifier = quoteQualifiedIdentifier(
    options.schemaName,
    options.tableName,
  );
  const policyName = assertIdentifier(options.policyName);
  const mode = options.mode ?? PolicyMode.PERMISSIVE;
  const command = options.command ?? PolicyCommand.ALL;
  const roles = options.roles ?? [];
  const roleSql = roles.map((role) => assertIdentifier(role)).join(", ");
  const predicates = getPolicyPredicates(options);

  return [
    `alter table ${tableIdentifier} enable row level security;`,
    `drop policy if exists ${policyName} on ${tableIdentifier};`,
    `create policy ${policyName} on ${tableIdentifier} as ${mode} for ${command}${roleSql ? ` to ${roleSql}` : ""} ${getPolicyPredicateSql(command, predicates)};`,
  ];
}

function getPolicyPredicates(options: PolicySqlOptions) {
  const command = options.command ?? PolicyCommand.ALL;
  const predicates = {
    using: normalizeExpression(options.using),
    withCheck: normalizeExpression(options.withCheck),
  };

  assertPolicyPredicates(command, predicates);

  return predicates;
}

function normalizeExpression(expression: string | undefined) {
  const normalized = expression?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
}

function assertPolicyPredicates(
  command: PolicyCommand,
  predicates: { using?: string; withCheck?: string },
) {
  if (command === PolicyCommand.SELECT || command === PolicyCommand.DELETE) {
    if (!predicates.using) {
      throw new Error("Policy using expression is required");
    }

    if (predicates.withCheck) {
      throw new Error(`Policy withCheck is not allowed for ${command}`);
    }

    return;
  }

  if (command === PolicyCommand.INSERT) {
    if (predicates.using) {
      throw new Error("Policy using is not allowed for insert");
    }

    if (!predicates.withCheck) {
      throw new Error("Policy withCheck expression is required");
    }

    return;
  }

  if (!predicates.using && !predicates.withCheck) {
    throw new Error("Policy using or withCheck expression is required");
  }
}

function getPolicyPredicateSql(
  command: PolicyCommand,
  predicates: { using?: string; withCheck?: string },
) {
  const fragments: string[] = [];

  if (command !== PolicyCommand.INSERT && predicates.using) {
    fragments.push(`using ${predicates.using}`);
  }

  if (
    command !== PolicyCommand.SELECT &&
    command !== PolicyCommand.DELETE &&
    predicates.withCheck
  ) {
    fragments.push(`with check ${predicates.withCheck}`);
  }

  return fragments.join(" ");
}
