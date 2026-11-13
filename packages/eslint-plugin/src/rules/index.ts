import graphqlFieldConfigFromTypes from "./graphql/graphql-field-config-from-types.js";
import graphqlFieldDefiniteAssignment from "./graphql/graphql-field-definite-assignment.js";
import entityPropertyConfigFromTypes from "./mikro-orm/entity-property-config-from-types.js";
import entityPropertyDefiniteAssignment from "./mikro-orm/entity-property-definite-assignment.js";
import entityPropertyNoSpread from "./mikro-orm/entity-property-no-spread.js";

export const rules = {
  "graphql-field-config-from-types": graphqlFieldConfigFromTypes,
  "entity-property-config-from-types": entityPropertyConfigFromTypes,
  "graphql-field-definite-assignment": graphqlFieldDefiniteAssignment,
  "entity-property-definite-assignment": entityPropertyDefiniteAssignment,
  "entity-property-no-spread": entityPropertyNoSpread,
};
