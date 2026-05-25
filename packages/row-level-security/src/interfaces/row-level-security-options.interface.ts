import { RowLevelSecurityContextValue } from "../utils/row-level-security-context-builder.types";

export type MaybePromise<T> = T | Promise<T>;

export type RowLevelSecurityContextEntries = Iterable<
  readonly [string, RowLevelSecurityContextValue]
>;

export interface RowLevelSecurityOptions {
  namespace?: string;
  authenticatedRole?: string;
  anonymousRole?: string;
  shouldApply?: () => MaybePromise<boolean>;
  isAuthenticated?: () => MaybePromise<boolean>;
  getContext?: () => MaybePromise<RowLevelSecurityContextEntries | undefined>;
}
