import { rowLevelSecurityOptionsState } from "./row-level-security-options-state";

/** Reads the process-level RLS options used by the entity manager. */
export function getRowLevelSecurityOptions() {
  return rowLevelSecurityOptionsState.value;
}
