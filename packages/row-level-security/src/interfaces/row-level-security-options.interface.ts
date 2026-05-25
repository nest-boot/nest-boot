import { RowLevelSecurityContextValue } from "../utils/row-level-security-context-builder.types";

/** Value or promise-like value accepted by row-level security option hooks. */
export type MaybePromise<T> = T | Promise<T>;

/** Context entries converted to transaction-local PostgreSQL settings. */
export type RowLevelSecurityContextEntries = Iterable<
  readonly [string, RowLevelSecurityContextValue]
>;

/** Runtime options used by {@link RowLevelSecurityEntityManager}. */
export interface RowLevelSecurityOptions {
  /** Database role used for authenticated requests. Defaults to `authenticated`. */
  authenticatedRole?: string;
  /** Database role used for anonymous requests. Defaults to `anonymous`. */
  anonymousRole?: string;
  /** Optional hook that can disable row-level security setup for a transaction. */
  shouldApply?: () => MaybePromise<boolean>;
  /** Optional hook used to infer the authenticated or anonymous role. */
  isAuthenticated?: () => MaybePromise<boolean>;
  /** Optional hook that contributes request context values to PostgreSQL settings. */
  getContext?: () => MaybePromise<RowLevelSecurityContextEntries | undefined>;
}
