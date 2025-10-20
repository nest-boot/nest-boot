import { describe, expect, it } from "@jest/globals";
import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

import {
  getClassDecorator,
  getPropertyDecorator,
  hasClassDecorator,
  hasPropertyDecorator,
} from "./decorators";

describe("decorators", () => {
  describe("hasClassDecorator", () => {
    it("should return true when class has the specified decorator", () => {
      const classDeclaration: TSESTree.ClassDeclaration = {
        type: AST_NODE_TYPES.ClassDeclaration,
        decorators: [
          {
            type: AST_NODE_TYPES.Decorator,
            expression: {
              type: AST_NODE_TYPES.CallExpression,
              callee: {
                type: AST_NODE_TYPES.Identifier,
                name: "Entity",
              },
            },
          } as TSESTree.Decorator,
        ],
      } as TSESTree.ClassDeclaration;

      expect(hasClassDecorator(classDeclaration, "Entity")).toBe(true);
    });

    it("should return true when class has one of the specified decorators", () => {
      const classDeclaration: TSESTree.ClassDeclaration = {
        type: AST_NODE_TYPES.ClassDeclaration,
        decorators: [
          {
            type: AST_NODE_TYPES.Decorator,
            expression: {
              type: AST_NODE_TYPES.CallExpression,
              callee: {
                type: AST_NODE_TYPES.Identifier,
                name: "ObjectType",
              },
            },
          } as TSESTree.Decorator,
        ],
      } as TSESTree.ClassDeclaration;

      expect(
        hasClassDecorator(classDeclaration, [
          "ObjectType",
          "InputType",
          "ArgsType",
        ]),
      ).toBe(true);
    });

    it("should return false when class does not have the specified decorator", () => {
      const classDeclaration: TSESTree.ClassDeclaration = {
        type: AST_NODE_TYPES.ClassDeclaration,
        decorators: [
          {
            type: AST_NODE_TYPES.Decorator,
            expression: {
              type: AST_NODE_TYPES.CallExpression,
              callee: {
                type: AST_NODE_TYPES.Identifier,
                name: "SomeOtherDecorator",
              },
            },
          } as TSESTree.Decorator,
        ],
      } as TSESTree.ClassDeclaration;

      expect(hasClassDecorator(classDeclaration, "Entity")).toBe(false);
    });

    it("should return false when class has no decorators", () => {
      const classDeclaration = {
        type: AST_NODE_TYPES.ClassDeclaration,
        decorators: [],
      } as unknown as TSESTree.ClassDeclaration;

      expect(hasClassDecorator(classDeclaration, "Entity")).toBe(false);
    });
  });

  describe("hasPropertyDecorator", () => {
    it("should return true when property has the specified decorator", () => {
      const propertyDefinition: TSESTree.PropertyDefinition = {
        type: AST_NODE_TYPES.PropertyDefinition,
        decorators: [
          {
            type: AST_NODE_TYPES.Decorator,
            expression: {
              type: AST_NODE_TYPES.CallExpression,
              callee: {
                type: AST_NODE_TYPES.Identifier,
                name: "Field",
              },
            },
          } as TSESTree.Decorator,
        ],
      } as TSESTree.PropertyDefinition;

      expect(hasPropertyDecorator(propertyDefinition, "Field")).toBe(true);
    });

    it("should return true when property has one of the specified decorators", () => {
      const propertyDefinition: TSESTree.PropertyDefinition = {
        type: AST_NODE_TYPES.PropertyDefinition,
        decorators: [
          {
            type: AST_NODE_TYPES.Decorator,
            expression: {
              type: AST_NODE_TYPES.CallExpression,
              callee: {
                type: AST_NODE_TYPES.Identifier,
                name: "Property",
              },
            },
          } as TSESTree.Decorator,
        ],
      } as TSESTree.PropertyDefinition;

      expect(
        hasPropertyDecorator(propertyDefinition, ["Property", "Field"]),
      ).toBe(true);
    });

    it("should return false when property does not have the specified decorator", () => {
      const propertyDefinition: TSESTree.PropertyDefinition = {
        type: AST_NODE_TYPES.PropertyDefinition,
        decorators: [
          {
            type: AST_NODE_TYPES.Decorator,
            expression: {
              type: AST_NODE_TYPES.CallExpression,
              callee: {
                type: AST_NODE_TYPES.Identifier,
                name: "SomeOtherDecorator",
              },
            },
          } as TSESTree.Decorator,
        ],
      } as TSESTree.PropertyDefinition;

      expect(hasPropertyDecorator(propertyDefinition, "Field")).toBe(false);
    });
  });

  describe("getClassDecorator", () => {
    it("should return the decorator when class has it", () => {
      const decorator: TSESTree.Decorator = {
        type: AST_NODE_TYPES.Decorator,
        expression: {
          type: AST_NODE_TYPES.CallExpression,
          callee: {
            type: AST_NODE_TYPES.Identifier,
            name: "Entity",
          },
        },
      } as TSESTree.Decorator;

      const classDeclaration: TSESTree.ClassDeclaration = {
        type: AST_NODE_TYPES.ClassDeclaration,
        decorators: [decorator],
      } as TSESTree.ClassDeclaration;

      expect(getClassDecorator(classDeclaration, "Entity")).toBe(decorator);
    });

    it("should return null when class does not have the decorator", () => {
      const classDeclaration = {
        type: AST_NODE_TYPES.ClassDeclaration,
        decorators: [],
      } as unknown as TSESTree.ClassDeclaration;

      expect(getClassDecorator(classDeclaration, "Entity")).toBeNull();
    });
  });

  describe("getPropertyDecorator", () => {
    it("should return the decorator when property has it", () => {
      const decorator: TSESTree.Decorator = {
        type: AST_NODE_TYPES.Decorator,
        expression: {
          type: AST_NODE_TYPES.CallExpression,
          callee: {
            type: AST_NODE_TYPES.Identifier,
            name: "Field",
          },
        },
      } as TSESTree.Decorator;

      const propertyDefinition: TSESTree.PropertyDefinition = {
        type: AST_NODE_TYPES.PropertyDefinition,
        decorators: [decorator],
      } as TSESTree.PropertyDefinition;

      expect(getPropertyDecorator(propertyDefinition, "Field")).toBe(decorator);
    });

    it("should return null when property does not have the decorator", () => {
      const propertyDefinition = {
        type: AST_NODE_TYPES.PropertyDefinition,
        decorators: [],
      } as unknown as TSESTree.PropertyDefinition;

      expect(getPropertyDecorator(propertyDefinition, "Field")).toBeNull();
    });
  });
});
