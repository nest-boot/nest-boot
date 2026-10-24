import type { ProcessMethodName } from "../interfaces/job-name.interface.js";

/**
 * Applies the same capitalization rule as ProcessMethodName.
 * @param name - Original BullMQ job name.
 * @returns Processor method name.
 */
export function getProcessMethodName<N extends string>(
  name: N,
): ProcessMethodName<N> {
  return `process${name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}` as ProcessMethodName<N>;
}

/**
 * Rejects names which cannot be dispatched to different processor methods.
 * @param names - Declared job names.
 */
export function assertUniqueProcessMethods(names: readonly string[]): void {
  const methods = new Map<string, string>();
  for (const name of names) {
    const method = getProcessMethodName(name);
    if (method === "process") {
      throw new Error(
        `Job name "${name}" cannot map to the reserved process method.`,
      );
    }
    const previous = methods.get(method);
    if (previous !== undefined) {
      throw new Error(
        `Jobs "${previous}" and "${name}" both map to ${method}.`,
      );
    }
    methods.set(method, name);
  }
}
