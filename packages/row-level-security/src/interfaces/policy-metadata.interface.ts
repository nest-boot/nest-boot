import { PolicyCommand } from "../enums/policy-command.enum.js";
import { PolicyMode } from "../enums/policy-mode.enum.js";

/** Normalized policy metadata stored by the {@link Policy} decorator. */
export interface PolicyMetadata {
  /** PostgreSQL policy name. */
  name: string;
  /** PostgreSQL policy mode. */
  mode: PolicyMode;
  /** PostgreSQL command covered by the policy. */
  command: PolicyCommand;
  /** SQL expression used as the `USING` predicate. */
  using?: string;
  /** SQL expression used as the `WITH CHECK` predicate. */
  withCheck?: string;
  /** Database roles to which the policy applies. */
  roles: string[];
  /** Additional SQL emitted before creating this policy. */
  bootstrapSql?: string[];
}

/** Entity metadata needed to derive policy names and predicates. */
export interface PolicyEntityMetadata {
  /** Entity class name. */
  entityName: string;
  /** Database schema name. */
  schemaName: string;
  /** Database table name. */
  tableName: string;
  /** MikroORM property metadata keyed by entity property name. */
  properties?: Record<string, PolicyEntityPropertyMetadata>;
}

/** Property metadata used to resolve policy column names and SQL context types. */
export interface PolicyEntityPropertyMetadata {
  /** Entity property name. */
  fieldName?: string;
  /** Database column names mapped by this property. */
  fieldNames?: string[];
  /** MikroORM property type. */
  type?: string;
  /** Runtime TypeScript type name. */
  runtimeType?: string;
  /** Database column type names. */
  columnTypes?: string[];
  /** Whether the property is a primary key. */
  primary?: boolean;
  /** Metadata for the relation target, when the property is a relation. */
  targetMeta?: PolicyEntityTargetMetadata;
}

/** Minimal target entity metadata used when a policy property points at a relation. */
export interface PolicyEntityTargetMetadata {
  /** Target entity class name. */
  className?: string;
  /** Target entity name. */
  name?: string;
  /** Primary key property names on the target entity. */
  primaryKeys?: string[];
  /** Target entity properties keyed by property name. */
  properties?: Record<string, PolicyEntityPropertyMetadata>;
}

/** Factory that derives policy metadata after MikroORM entity metadata is available. */
export type PolicyMetadataFactory = (
  entityMetadata: PolicyEntityMetadata,
) => PolicyMetadata;

/** Stored policy metadata entry, either static or entity-metadata aware. */
export type PolicyMetadataEntry = PolicyMetadata | PolicyMetadataFactory;
