import type { Type } from "@nestjs/common";
import type { ModuleRef } from "@nestjs/core";
import { InvalidClassScopeException } from "@nestjs/core/errors/exceptions/invalid-class-scope.exception";
import { UnknownElementException } from "@nestjs/core/errors/exceptions/unknown-element.exception";

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
