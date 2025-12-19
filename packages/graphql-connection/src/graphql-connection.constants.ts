/**
 * Symbol used as a metadata key for storing connection metadata on connection classes.
 *
 * This symbol is used internally by the connection builder to attach metadata
 * (entity class, field options, filter schema) to generated connection classes.
 * The metadata is then used by the ConnectionQueryBuilder to construct queries.
 *
 * @internal
 */
export const GRAPHQL_CONNECTION_METADATA = Symbol(
  "GRAPHQL_CONNECTION_METADATA",
);
