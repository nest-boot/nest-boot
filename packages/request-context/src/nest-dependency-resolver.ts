import type { Type } from "@nestjs/common";
import type { ModuleRef } from "@nestjs/core";

import type { RequestContextDependencyResolver } from "./request-context.js";

/** Creates a lazy resolver for singleton providers in the Nest container. */
export function createNestDependencyResolver(
  moduleRef: ModuleRef,
): RequestContextDependencyResolver {
  return (token) => {
    try {
      return moduleRef.get(token as string | symbol | Type<unknown>, {
        strict: false,
      });
    } catch {
      return undefined;
    }
  };
}
