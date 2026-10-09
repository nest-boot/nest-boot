import graphqlFieldConfigFromTypes from "./graphql/graphql-field-config-from-types.js";
import graphqlFieldDefiniteAssignment from "./graphql/graphql-field-definite-assignment.js";
import importDatabase from "./import/import-database.js";
import importGraphql from "./import/import-graphql.js";
import importQueue from "./import/import-queue.js";
import entityFieldDefiniteAssignment from "./mikro-orm/entity-field-definite-assignment.js";
import entityPropertyConfigFromTypes from "./mikro-orm/entity-property-config-from-types.js";

export const rules = {
  "graphql-field-config-from-types": graphqlFieldConfigFromTypes,
  "entity-property-config-from-types": entityPropertyConfigFromTypes,
  "graphql-field-definite-assignment": graphqlFieldDefiniteAssignment,
  "entity-field-definite-assignment": entityFieldDefiniteAssignment,
  "import-queue": importQueue,
  "import-graphql": importGraphql,
  "import-database": importDatabase,
};
