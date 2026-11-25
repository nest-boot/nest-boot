import type { TSESLint } from "@typescript-eslint/utils";

import graphqlFieldConfigFromTypes from "./graphql/graphql-field-config-from-types.js";
import graphqlFieldDefiniteAssignment from "./graphql/graphql-field-definite-assignment.js";
import noDirectNestjsImport from "./graphql/no-direct-nestjs-import.js";
import entityPropertyConfigFromTypes from "./mikro-orm/entity-property-config-from-types.js";
import entityPropertyDefiniteAssignment from "./mikro-orm/entity-property-definite-assignment.js";
import entityPropertyNoSpread from "./mikro-orm/entity-property-no-spread.js";
import processorName from "./queue/processor-name.js";

/** All Nest Boot ESLint rules keyed by `<domain>/<rule>`. */
export const rules: Record<
  string,
  TSESLint.RuleModule<string, readonly unknown[]>
> = {
  "database/entity-property-config-from-types": entityPropertyConfigFromTypes,
  "database/entity-property-definite-assignment":
    entityPropertyDefiniteAssignment,
  "database/entity-property-no-spread": entityPropertyNoSpread,
  "graphql/field-config-from-types": graphqlFieldConfigFromTypes,
  "graphql/field-definite-assignment": graphqlFieldDefiniteAssignment,
  "graphql/no-direct-nestjs-import": noDirectNestjsImport,
  "queue/processor-name": processorName,
};
