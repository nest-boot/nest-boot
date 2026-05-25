import { RequestContext } from "@nest-boot/request-context";

import {
  RowLevelSecurityContextValue,
  SnakeCase,
} from "./utils/row-level-security-context-builder.types";

type RowLevelSecurityContextMap = Map<string, RowLevelSecurityContextValue>;

const ROW_LEVEL_SECURITY_CONTEXT = Symbol("ROW_LEVEL_SECURITY_CONTEXT");
const ROW_LEVEL_SECURITY_ROLE = Symbol("ROW_LEVEL_SECURITY_ROLE");

/** Request-scoped row-level security role and context helpers. */
export class RowLevelSecurityContext {
  /** Stores the database role that should be applied to the next RLS transaction. */
  static setRole(role: string): void {
    RequestContext.set(ROW_LEVEL_SECURITY_ROLE, role);
  }

  /** Reads the request-scoped database role, if one is active. */
  static getRole(): string | undefined {
    return RequestContext.isActive()
      ? RequestContext.get<string>(ROW_LEVEL_SECURITY_ROLE)
      : undefined;
  }

  /** Stores a context value that will be converted to a PostgreSQL setting. */
  static set<S extends string>(
    key: SnakeCase<S>,
    value: RowLevelSecurityContextValue,
  ): void {
    const context = RequestContext.getOrSet<RowLevelSecurityContextMap>(
      ROW_LEVEL_SECURITY_CONTEXT,
      new Map(),
    );

    context.set(key, value);
  }

  /** Reads a request-scoped context value by key. */
  static get<S extends string>(
    key: SnakeCase<S>,
  ): RowLevelSecurityContextValue {
    return RequestContext.isActive()
      ? RequestContext.get<RowLevelSecurityContextMap>(
          ROW_LEVEL_SECURITY_CONTEXT,
        )?.get(key)
      : undefined;
  }

  /** Returns all request-scoped context entries for RLS transaction setup. */
  static entries(): [string, RowLevelSecurityContextValue][] {
    return RequestContext.isActive()
      ? Array.from(
          RequestContext.get<RowLevelSecurityContextMap>(
            ROW_LEVEL_SECURITY_CONTEXT,
          ) ?? [],
        )
      : [];
  }
}
