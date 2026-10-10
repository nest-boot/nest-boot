import "reflect-metadata";

import type { ModuleRef } from "@nestjs/core";
import { InvalidClassScopeException } from "@nestjs/core/errors/exceptions/invalid-class-scope.exception";
import { UnknownElementException } from "@nestjs/core/errors/exceptions/unknown-element.exception";

import { createNestDependencyResolver } from "./nest-dependency-resolver.js";

describe("createNestDependencyResolver", () => {
  class Provider {}

  it.each([
    new UnknownElementException(Provider.name),
    new InvalidClassScopeException(Provider),
  ])("returns undefined for an unavailable provider", (error) => {
    const moduleRef = {
      get: vi.fn(() => {
        throw error;
      }),
    } as unknown as ModuleRef;

    expect(createNestDependencyResolver(moduleRef)(Provider)).toBeUndefined();
  });

  it("rethrows unexpected provider resolution errors", () => {
    const error = new Error("provider initialization failed");
    const moduleRef = {
      get: vi.fn(() => {
        throw error;
      }),
    } as unknown as ModuleRef;

    expect(() => createNestDependencyResolver(moduleRef)(Provider)).toThrow(
      error,
    );
  });
});
