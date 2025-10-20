import graphqlFieldConfigFromTypes from "./graphql/graphql-field-config-from-types";
import graphqlFieldDefiniteAssignment from "./graphql/graphql-field-definite-assignment";
import importBullmq from "./import/import-bullmq";
import importGraphql from "./import/import-graphql";
import importMikroOrm from "./import/import-mikro-orm";
import entityFieldDefiniteAssignment from "./mikro-orm/entity-field-definite-assignment";
import entityPropertyConfigFromTypes from "./mikro-orm/entity-property-config-from-types";

export const rules = {
  "graphql-field-config-from-types": graphqlFieldConfigFromTypes,
  "entity-property-config-from-types": entityPropertyConfigFromTypes,
  "graphql-field-definite-assignment": graphqlFieldDefiniteAssignment,
  "entity-field-definite-assignment": entityFieldDefiniteAssignment,
  "import-bullmq": importBullmq,
  "import-graphql": importGraphql,
  "import-mikro-orm": importMikroOrm,
};
