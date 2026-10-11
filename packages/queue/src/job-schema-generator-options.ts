/**
 * Excludes BullMQ-owned tables from both metadata targets and database introspection.
 * Spread into MikroORM's schemaGenerator options when discovering the built-in Job entity.
 * For a custom BullMQ schema, exclude that schema as well and pass it to JobService via connection.schema.
 */
export const jobSchemaGeneratorOptions = {
  ignoreSchema: ["bullmq"],
  skipTables: ["*.job", "bullmq.job"],
};
