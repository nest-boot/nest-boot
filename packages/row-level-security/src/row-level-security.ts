import { RequestContext } from "@nest-boot/request-context";

import {
  RowLevelSecurityContextValue,
  SnakeCase,
} from "./utils/row-level-security-context-builder.types";

type RowLevelSecurityContextMap = Map<string, RowLevelSecurityContextValue>;

const ROW_LEVEL_SECURITY_CONTEXT = Symbol("ROW_LEVEL_SECURITY_CONTEXT");
const ROW_LEVEL_SECURITY_MODE = Symbol("ROW_LEVEL_SECURITY_MODE");
const ROW_LEVEL_SECURITY_ROLE = Symbol("ROW_LEVEL_SECURITY_ROLE");

/** Request-scoped row-level security execution mode. */
export enum RowLevelSecurityMode {
  /** Apply RLS only when a role or context value is present. */
  AUTO = "auto",
  /** Always apply RLS while request context is active. */
  ENABLED = "enabled",
  /** Never apply RLS, even when role or context values are present. */
  DISABLED = "disabled",
}

/** Request-scoped row-level security mode, role, and context helpers. */
export class RowLevelSecurity {
  /** Stores the row-level security mode for the current request context. */
  static setMode(mode: RowLevelSecurityMode): void {
    RequestContext.set(ROW_LEVEL_SECURITY_MODE, mode);
  }

  /** Reads the request-scoped row-level security mode. */
  static getMode(): RowLevelSecurityMode {
    return RequestContext.isActive()
      ? (RequestContext.get<RowLevelSecurityMode>(ROW_LEVEL_SECURITY_MODE) ??
          RowLevelSecurityMode.AUTO)
      : RowLevelSecurityMode.AUTO;
  }

  /** Stores the database role that should be applied to the next RLS query. */
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
  static setContext<S extends string>(
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
  static getContext<S extends string>(
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

  /** Clears request-scoped RLS mode, role, and context values. */
  static clear(): void {
    if (!RequestContext.isActive()) {
      return;
    }

    RequestContext.set(ROW_LEVEL_SECURITY_MODE, RowLevelSecurityMode.AUTO);
    RequestContext.set<string | undefined>(ROW_LEVEL_SECURITY_ROLE, undefined);
    RequestContext.set<RowLevelSecurityContextMap>(
      ROW_LEVEL_SECURITY_CONTEXT,
      new Map(),
    );
  }
}
