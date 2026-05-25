import { RowLevelSecurityOptions } from "../interfaces/row-level-security-options.interface";
import { DEFAULT_ROW_LEVEL_SECURITY_OPTIONS } from "./default-row-level-security-options";
import { rowLevelSecurityOptionsState } from "./row-level-security-options-state";

/** Replaces the process-level RLS options used by {@link RowLevelSecurityEntityManager}. */
export function setRowLevelSecurityOptions(
  options: RowLevelSecurityOptions = {},
) {
  rowLevelSecurityOptionsState.value = {
    ...DEFAULT_ROW_LEVEL_SECURITY_OPTIONS,
    ...options,
  };
}
