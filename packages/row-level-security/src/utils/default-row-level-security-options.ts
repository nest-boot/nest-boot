import { RowLevelSecurityOptions } from "../interfaces/row-level-security-options.interface";

export const DEFAULT_ROW_LEVEL_SECURITY_OPTIONS: Required<
  Pick<
    RowLevelSecurityOptions,
    "namespace" | "authenticatedRole" | "anonymousRole"
  >
> = {
  namespace: "app",
  authenticatedRole: "authenticated",
  anonymousRole: "anonymous",
};
