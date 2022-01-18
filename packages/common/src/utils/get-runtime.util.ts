import { RUNTIME_KEY } from "../constants";

export function getRuntime(): string {
  return process[RUNTIME_KEY];
}
