import { RowLevelSecurityOptions } from "../interfaces/row-level-security-options.interface";
import { DEFAULT_ROW_LEVEL_SECURITY_OPTIONS } from "./default-row-level-security-options";

export const rowLevelSecurityOptionsState: {
  value: RowLevelSecurityOptions;
} = {
  value: DEFAULT_ROW_LEVEL_SECURITY_OPTIONS,
};
