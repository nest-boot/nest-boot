import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESTree,
} from "@typescript-eslint/utils";
import { Scope } from "@typescript-eslint/utils/ts-eslint";
import * as ts from "typescript";

import { createRule } from "../../utils/createRule.js";
import { importedBindingName } from "../../utils/named-imports.js";

export default createRule<[], "processorName">({
  name: "processor-name",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Requires a processor class name to match its declared queue class.",
    },
    schema: [],
    messages: {
      processorName:
        'Processor for "{{queueName}}" must be named "{{expectedName}}".',
    },
  },
  defaultOptions: [],
  create(context) {
    const source = context.sourceCode;

    const queueClassName = (node: TSESTree.Node): string | null => {
      const { program, esTreeNodeToTSNodeMap } = source.parserServices ?? {};
      if (program && esTreeNodeToTSNodeMap) {
        const symbol = program
          .getTypeChecker()
          .getTypeAtLocation(esTreeNodeToTSNodeMap.get(node))
          .getSymbol();
        const declaration = symbol
          ?.getDeclarations()
          ?.find(ts.isClassDeclaration);
        if (declaration?.name) {
          return declaration.name.text;
        }
      }
      if (node.type === AST_NODE_TYPES.Identifier) {
        const variable = ASTUtils.findVariable(source.getScope(node), node);
        if (!variable) {
          return node.name;
        }
        for (const definition of variable.defs) {
          if (definition.type === Scope.DefinitionType.ClassName) {
            return definition.node.id?.name ?? null;
          }
          if (definition.type === Scope.DefinitionType.ImportBinding) {
            const specifier = definition.node;
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
              return specifier.imported.type === AST_NODE_TYPES.Identifier
                ? specifier.imported.name
                : specifier.imported.value;
            }
            if (specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier) {
              return specifier.local.name;
            }
          }
        }
      }
      if (
        node.type === AST_NODE_TYPES.MemberExpression &&
        node.object.type === AST_NODE_TYPES.Identifier
      ) {
        const variable = ASTUtils.findVariable(
          source.getScope(node.object),
          node.object,
        );
        if (
          !variable?.defs.some(
            (definition) =>
              definition.type === Scope.DefinitionType.ImportBinding &&
              definition.node.type === AST_NODE_TYPES.ImportNamespaceSpecifier,
          )
        ) {
          return null;
        }
        if (
          !node.computed &&
          node.property.type === AST_NODE_TYPES.Identifier
        ) {
          return node.property.name;
        }
        if (
          node.computed &&
          node.property.type === AST_NODE_TYPES.Literal &&
          typeof node.property.value === "string"
        ) {
          return node.property.value;
        }
      }
      return null;
    };

    return {
      ClassDeclaration(node) {
        for (const decorator of node.decorators) {
          const call = decorator.expression;
          if (
            call.type !== AST_NODE_TYPES.CallExpression ||
            importedBindingName(source, "@nest-boot/queue", call.callee) !==
              "Processor"
          ) {
            continue;
          }
          const queue = call.arguments.at(0);
          if (!queue) {
            continue;
          }
          const queueName = queueClassName(queue);
          if (!queueName) {
            continue;
          }
          const expectedName = `${queueName.replace(/Queue$/, "")}Processor`;
          if (node.id?.name !== expectedName) {
            context.report({
              node: node.id ?? node,
              messageId: "processorName",
              data: { queueName, expectedName },
            });
          }
        }
      },
    };
  },
});
