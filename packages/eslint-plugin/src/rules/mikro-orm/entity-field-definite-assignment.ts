import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/utils";

import { createRule } from "../../utils/createRule";
import {
  hasClassDecorator,
  hasPropertyDecorator,
} from "../../utils/decorators";

export default createRule({
  name: "entity-field-definite-assignment",
  meta: {
    type: "suggestion",
    fixable: "code",
    schema: [],
    docs: {
      description: "Avoid looping over enums.",
    },
    messages: {
      addDefiniteAssignment: "Add definite assignment assertion (!).",
      removeDefiniteAssignment: "Remove definite assignment assertion (!).",
    },
  },
  defaultOptions: [],
  create(context) {
    const source = context.sourceCode;

    const isEntityClass = (node: TSESTree.ClassDeclaration): boolean => {
      return hasClassDecorator(node, "Entity");
    };

    const getPropertyName = (
      member: TSESTree.PropertyDefinition,
    ): string | null => {
      if (member.key.type === AST_NODE_TYPES.Identifier) {
        return member.key.name;
      }
      return null;
    };

    const hasInitializer = (member: TSESTree.PropertyDefinition): boolean => {
      return !!member.value;
    };

    const hasDefiniteAssignment = (
      member: TSESTree.PropertyDefinition,
    ): boolean => {
      return member.definite;
    };

    const isOptionalProperty = (
      member: TSESTree.PropertyDefinition,
    ): boolean => {
      // 检查 AST 节点的 optional 标记
      if (member.optional) return true;

      // 检查源代码中是否有 ? 符号（在属性名和冒号之间）
      const keyEnd = member.key.range[1];
      const text = source.text;
      for (let i = keyEnd; i < member.range[1]; i++) {
        if (text[i] === "?") return true;
        if (text[i] === ":" || text[i] === "!") break;
      }

      return false;
    };

    return {
      ClassDeclaration(node) {
        if (!isEntityClass(node)) return;

        node.body.body.forEach((member: TSESTree.ClassElement) => {
          if (member.type !== AST_NODE_TYPES.PropertyDefinition) return;
          if (
            !hasPropertyDecorator(member, [
              "Property",
              "Enum",
              "OneToOne",
              "OneToMany",
              "ManyToOne",
              "ManyToMany",
            ])
          )
            return;

          const propertyName = getPropertyName(member);
          if (!propertyName) return;

          // 可选属性（?:）不需要 definite assignment assertion
          if (isOptionalProperty(member)) return;

          const hasInit = hasInitializer(member);
          const hasDefinite = hasDefiniteAssignment(member);

          // 情况1: 没有初始化值，但也没有 definite assignment assertion
          if (!hasInit && !hasDefinite) {
            context.report({
              node: member,
              messageId: "addDefiniteAssignment",
              data: {
                propertyName,
              },
              fix: (fixer) => {
                // 找到属性名称的结束位置
                const keyEnd = member.key.range[1];
                // 在属性名称后添加 !
                return fixer.insertTextAfterRange([keyEnd, keyEnd], "!");
              },
            });
          }

          // 情况2: 有初始化值，但也有 definite assignment assertion
          if (hasInit && hasDefinite) {
            context.report({
              node: member,
              messageId: "removeDefiniteAssignment",
              data: {
                propertyName,
              },
              fix: (fixer) => {
                // 找到 ! 的位置并移除
                const keyEnd = member.key.range[1];
                const text = source.text;

                // 查找 ! 的位置（在属性名称和冒号之间）
                let exclamationPos = -1;
                for (let i = keyEnd; i < member.range[1]; i++) {
                  if (text[i] === "!") {
                    exclamationPos = i;
                    break;
                  }
                  // 如果遇到冒号，说明没有 !
                  if (text[i] === ":") {
                    break;
                  }
                }

                if (exclamationPos !== -1) {
                  return fixer.removeRange([
                    exclamationPos,
                    exclamationPos + 1,
                  ]);
                }
                return null;
              },
            });
          }
        });
      },
    };
  },
});
