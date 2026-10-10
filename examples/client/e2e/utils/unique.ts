import { test } from "@playwright/test";

export function uniqueSeed(prefix: string) {
  return `${prefix}-${Date.now()}-${test.info().parallelIndex}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
