import type { ModuleRef } from "@nestjs/core";
import { InvalidClassScopeException } from "@nestjs/core/errors/exceptions/invalid-class-scope.exception";
import { UnknownElementException } from "@nestjs/core/errors/exceptions/unknown-element.exception";

import type { RequestContextDependencyResolver } from "./request-context.js";

/**
 * Creates a lazy resolver for singleton providers in the Nest container.
 * @param moduleRef - Nest module reference used to resolve dependencies.
 * @returns Resolver that retrieves static Nest providers when available.
 */
export function createNestDependencyResolver(
  moduleRef: ModuleRef,
): RequestContextDependencyResolver {
  return (token) => {
    try {
      return moduleRef.get(token, {
        strict: false,
      });
    } catch (error) {
      if (
        error instanceof UnknownElementException ||
        error instanceof InvalidClassScopeException
      ) {
        return undefined;
      }

      throw error;
    }
  };
}
