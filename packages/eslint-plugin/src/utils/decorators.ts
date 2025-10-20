import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

/**
 * 检查类是否有指定的装饰器
 * @param classDeclaration 类声明节点
 * @param decoratorNames 装饰器名称（可以是字符串或字符串数组）
 * @returns 是否有指定的装饰器
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
 * 检查属性是否有指定的装饰器
 * @param propertyDefinition 属性定义节点
 * @param decoratorNames 装饰器名称（可以是字符串或字符串数组）
 * @returns 是否有指定的装饰器
 */
export function hasPropertyDecorator(
  propertyDefinition: TSESTree.PropertyDefinition,
  decoratorNames: string | string[],
): boolean {
  const names = Array.isArray(decoratorNames)
    ? decoratorNames
    : [decoratorNames];

  return propertyDefinition.decorators.some(
    (decorator: TSESTree.Decorator) => {
      if (decorator.expression.type !== AST_NODE_TYPES.CallExpression) {
        return false;
      }
      if (decorator.expression.callee.type !== AST_NODE_TYPES.Identifier) {
        return false;
      }
      return names.includes(decorator.expression.callee.name);
    },
  );
}

/**
 * 获取类的装饰器
 * @param classDeclaration 类声明节点
 * @param decoratorName 装饰器名称
 * @returns 装饰器节点，如果不存在则返回 null
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
 * 获取属性的装饰器
 * @param propertyDefinition 属性定义节点
 * @param decoratorName 装饰器名称
 * @returns 装饰器节点，如果不存在则返回 null
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
