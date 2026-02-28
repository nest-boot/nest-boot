import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

/**
 * Checks whether a class has the specified decorator(s).
 * @param classDeclaration - The class declaration node.
 * @param decoratorNames - Decorator name(s) (can be a string or an array of strings).
 * @returns Whether the class has the specified decorator(s).
 */
export function hasClassDecorator(
  classDeclaration: TSESTree.ClassDeclaration,
  decoratorNames: string | string[],
): boolean {
  const names = Array.isArray(decoratorNames)
    ? decoratorNames
    : [decoratorNames];

  return classDeclaration.decorators.some((decorator: TSESTree.Decorator) => {
    if (decorator.expression.type !== AST_NODE_TYPES.CallExpression) {
      return false;
    }
    if (decorator.expression.callee.type !== AST_NODE_TYPES.Identifier) {
      return false;
    }
    return names.includes(decorator.expression.callee.name);
  });
}

/**
 * Checks whether a property has the specified decorator(s).
 * @param propertyDefinition - The property definition node.
 * @param decoratorNames - Decorator name(s) (can be a string or an array of strings).
 * @returns Whether the property has the specified decorator(s).
 */
export function hasPropertyDecorator(
  propertyDefinition: TSESTree.PropertyDefinition,
  decoratorNames: string | string[],
): boolean {
  const names = Array.isArray(decoratorNames)
    ? decoratorNames
    : [decoratorNames];

  return propertyDefinition.decorators.some((decorator: TSESTree.Decorator) => {
    if (decorator.expression.type !== AST_NODE_TYPES.CallExpression) {
      return false;
    }
    if (decorator.expression.callee.type !== AST_NODE_TYPES.Identifier) {
      return false;
    }
    return names.includes(decorator.expression.callee.name);
  });
}

/**
 * Gets a decorator from a class declaration.
 * @param classDeclaration - The class declaration node.
 * @param decoratorName - The decorator name.
 * @returns The decorator node, or null if not found.
 */
export function getClassDecorator(
  classDeclaration: TSESTree.ClassDeclaration,
  decoratorName: string,
): TSESTree.Decorator | null {
  return (
    classDeclaration.decorators.find((decorator: TSESTree.Decorator) => {
      return (
        decorator.expression.type === AST_NODE_TYPES.CallExpression &&
        decorator.expression.callee.type === AST_NODE_TYPES.Identifier &&
        decorator.expression.callee.name === decoratorName
      );
    }) ?? null
  );
}

/**
 * Gets a decorator from a property definition.
 * @param propertyDefinition - The property definition node.
 * @param decoratorName - The decorator name.
 * @returns The decorator node, or null if not found.
 */
export function getPropertyDecorator(
  propertyDefinition: TSESTree.PropertyDefinition,
  decoratorName: string,
): TSESTree.Decorator | null {
  return (
    propertyDefinition.decorators.find((decorator: TSESTree.Decorator) => {
      return (
        decorator.expression.type === AST_NODE_TYPES.CallExpression &&
        decorator.expression.callee.type === AST_NODE_TYPES.Identifier &&
        decorator.expression.callee.name === decoratorName
      );
    }) ?? null
  );
}
