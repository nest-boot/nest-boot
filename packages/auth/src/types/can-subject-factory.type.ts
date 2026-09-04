import type { Subject } from "@casl/ability";

/** Factory that resolves a permission subject from the current handler instance and decorated method parameters. */
export type CanSubjectFactory<
  T extends Subject = Subject,
  TSelf = unknown,
  TArgs extends unknown[] = unknown[],
> = (self: TSelf, ...args: TArgs) => T | Promise<T>;
