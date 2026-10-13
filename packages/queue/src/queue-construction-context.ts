import type { QueueModuleOptions } from "./queue-module-options.interface.js";

interface QueueConstructionContext {
  target: object;
  options: QueueModuleOptions;
}

let current: QueueConstructionContext | undefined;

/** Supplies options only during synchronous construction, restoring nested contexts. */
export const queueConstructionContext = {
  getStore: () => current,
  run<T>(context: QueueConstructionContext, construct: () => T): T {
    const previous = current;
    current = context;
    try {
      return construct();
    } finally {
      // Nest resolves async dependencies before construction; no async work may retain this state.
      current = previous;
    }
  },
};
