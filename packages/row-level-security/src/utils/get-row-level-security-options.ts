import { rowLevelSecurityOptionsState } from "./row-level-security-options-state";

export function getRowLevelSecurityOptions() {
  return rowLevelSecurityOptionsState.value;
}
