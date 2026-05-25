import { RowLevelSecurityOptions } from "../interfaces/row-level-security-options.interface";

/** Default RLS database roles. */
export const DEFAULT_ROW_LEVEL_SECURITY_OPTIONS: Required<
  Pick<RowLevelSecurityOptions, "authenticatedRole" | "anonymousRole">
> = {
  authenticatedRole: "authenticated",
  anonymousRole: "anonymous",
};
