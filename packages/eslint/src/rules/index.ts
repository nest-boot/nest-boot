import type { TSESLint } from "@typescript-eslint/utils";

import type { PluginDocs } from "../utils/createRule.js";
import databaseEntityPropertyConfigFromTypes from "./database-entity-property-config-from-types.js";
import databaseEntityPropertyDefiniteAssignment from "./database-entity-property-definite-assignment.js";
import databaseEntityPropertyNoSpread from "./database-entity-property-no-spread.js";
import graphqlFieldConfigFromTypes from "./graphql-field-config-from-types.js";
import graphqlFieldDefiniteAssignment from "./graphql-field-definite-assignment.js";
import graphqlNoDirectNestjsImport from "./graphql-no-direct-nestjs-import.js";
import queueProcessorName from "./queue-processor-name.js";

/** All Nest Boot ESLint rules keyed by `<domain>-<rule>`. */
export const rules: Record<
  string,
  TSESLint.RuleModule<string, readonly unknown[], PluginDocs>
> = {
  "database-entity-property-config-from-types":
    databaseEntityPropertyConfigFromTypes,
  "database-entity-property-definite-assignment":
    databaseEntityPropertyDefiniteAssignment,
  "database-entity-property-no-spread": databaseEntityPropertyNoSpread,
  "graphql-field-config-from-types": graphqlFieldConfigFromTypes,
  "graphql-field-definite-assignment": graphqlFieldDefiniteAssignment,
  "graphql-no-direct-nestjs-import": graphqlNoDirectNestjsImport,
  "queue-processor-name": queueProcessorName,
};
