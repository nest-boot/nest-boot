import { ESLintUtils } from "@typescript-eslint/utils";

/** Documentation metadata supported by Nest Boot ESLint rules. */
export interface PluginDocs {
  recommended?: boolean;
  requiresTypeChecking?: boolean;
}

/** Rule factory binding Nest Boot documentation URLs and typed rule metadata. */
export const createRule = ESLintUtils.RuleCreator<PluginDocs>(
  (name) =>
    `https://github.com/nest-boot/nest-boot/blob/main/packages/eslint/docs/rules/${name}.md`,
);
