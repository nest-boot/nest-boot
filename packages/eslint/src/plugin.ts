import type { ESLint } from "eslint";

import graphqlFieldConfigFromTypes from "./rules/graphql/graphql-field-config-from-types.js";
import graphqlFieldDefiniteAssignment from "./rules/graphql/graphql-field-definite-assignment.js";
import noDirectNestjsImport from "./rules/graphql/no-direct-nestjs-import.js";
import entityPropertyConfigFromTypes from "./rules/mikro-orm/entity-property-config-from-types.js";
import entityPropertyDefiniteAssignment from "./rules/mikro-orm/entity-property-definite-assignment.js";
import entityPropertyNoSpread from "./rules/mikro-orm/entity-property-no-spread.js";
import processorName from "./rules/queue/processor-name.js";

/** ESLint plugin exposing all Nest Boot rules under `nest-boot/<domain>/<rule>`. */
export const plugin = {
  meta: {
    name: "@nest-boot/eslint",
  },
  rules: {
    "database/entity-property-config-from-types": entityPropertyConfigFromTypes,
    "database/entity-property-definite-assignment":
      entityPropertyDefiniteAssignment,
    "database/entity-property-no-spread": entityPropertyNoSpread,
    "graphql/field-config-from-types": graphqlFieldConfigFromTypes,
    "graphql/field-definite-assignment": graphqlFieldDefiniteAssignment,
    "graphql/no-direct-nestjs-import": noDirectNestjsImport,
    "queue/processor-name": processorName,
  },
} as unknown as ESLint.Plugin;
