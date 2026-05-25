import { RequestContext } from "@nest-boot/request-context";

import {
  RowLevelSecurityContextValue,
  SnakeCase,
} from "./utils/row-level-security-context-builder.types";

type RowLevelSecurityContextMap = Map<string, RowLevelSecurityContextValue>;

const ROW_LEVEL_SECURITY_CONTEXT = Symbol("ROW_LEVEL_SECURITY_CONTEXT");
const ROW_LEVEL_SECURITY_ROLE = Symbol("ROW_LEVEL_SECURITY_ROLE");

export class RowLevelSecurityContext {
  static setRole(role: string): void {
    RequestContext.set(ROW_LEVEL_SECURITY_ROLE, role);
  }

  static getRole(): string | undefined {
    return RequestContext.isActive()
      ? RequestContext.get<string>(ROW_LEVEL_SECURITY_ROLE)
      : undefined;
  }

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

  static get<S extends string>(
    key: SnakeCase<S>,
  ): RowLevelSecurityContextValue {
    return RequestContext.isActive()
      ? RequestContext.get<RowLevelSecurityContextMap>(
          ROW_LEVEL_SECURITY_CONTEXT,
        )?.get(key)
      : undefined;
  }

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
