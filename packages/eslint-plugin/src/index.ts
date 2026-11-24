import type { ESLint } from "eslint";

import graphqlFieldConfigFromTypes from "./rules/graphql/graphql-field-config-from-types.js";
import graphqlFieldDefiniteAssignment from "./rules/graphql/graphql-field-definite-assignment.js";
import entityPropertyConfigFromTypes from "./rules/mikro-orm/entity-property-config-from-types.js";
import entityPropertyDefiniteAssignment from "./rules/mikro-orm/entity-property-definite-assignment.js";
import entityPropertyNoSpread from "./rules/mikro-orm/entity-property-no-spread.js";
import processorName from "./rules/queue/processor-name.js";

/** Entity rules registered under the @nest-boot/database namespace. */
export const databasePlugin = {
  rules: {
    "entity-property-config-from-types": entityPropertyConfigFromTypes,
    "entity-property-definite-assignment": entityPropertyDefiniteAssignment,
    "entity-property-no-spread": entityPropertyNoSpread,
  },
} as unknown as ESLint.Plugin;

/** GraphQL rules registered under the @nest-boot/graphql namespace. */
export const graphqlPlugin = {
  rules: {
    "field-config-from-types": graphqlFieldConfigFromTypes,
    "field-definite-assignment": graphqlFieldDefiniteAssignment,
  },
} as unknown as ESLint.Plugin;

/** Queue rules registered under the @nest-boot/queue namespace. */
export const queuePlugin = {
  rules: {
    "processor-name": processorName,
  },
} as unknown as ESLint.Plugin;

/** Preserves the flat rule IDs used by earlier v8 shared configs. */
const legacyPlugin = {
  rules: {
    ...databasePlugin.rules,
    "graphql-field-config-from-types": graphqlFieldConfigFromTypes,
    "graphql-field-definite-assignment": graphqlFieldDefiniteAssignment,
  },
} as unknown as ESLint.Plugin;

export default legacyPlugin;
