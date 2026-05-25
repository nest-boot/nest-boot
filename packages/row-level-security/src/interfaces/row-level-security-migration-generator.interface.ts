import type { PolicySqlOptions } from "./policy-sql-options.interface";

/** SQL diff shape passed from MikroORM to migration generators. */
export interface MigrationDiff {
  /** SQL statements applied by the generated migration. */
  up: string[];
  /** SQL statements applied when reverting the generated migration. */
  down: string[];
}

export interface EntityMetadataLike {
  class?: object & { name?: string };
  className?: string;
  name?: string;
  schema?: string;
  tableName?: string;
  collection?: string;
  properties?: Record<string, EntityPropertyLike>;
}

export interface EntityPropertyLike {
  fieldName?: string;
  fieldNames?: string[];
  type?: string;
  runtimeType?: string;
  columnTypes?: string[];
  primary?: boolean;
  targetMeta?: EntityTargetMetadataLike;
}

export interface EntityTargetMetadataLike {
  className?: string;
  name?: string;
  primaryKeys?: string[];
  properties?: Record<string, EntityPropertyLike>;
}

export interface MetadataStorageLike {
  getAll(): EntityMetadataLike[] | Record<string, EntityMetadataLike>;
}

export interface DatabaseConnectionLike {
  execute<T>(sql: string): Promise<T>;
}

export interface RowLevelSecurityMigrationGeneratorDriverLike {
  config?: {
    getMetadata?: () => MetadataStorageLike;
  };
  getConnection?: () => DatabaseConnectionLike;
  getMetadata?: () => MetadataStorageLike;
}

export interface RowLevelSecurityDefinition extends PolicySqlOptions {
  entityName: string;
  bootstrapSql?: string[];
}

export interface TableReference {
  schemaName: string;
  tableName: string;
}

export interface PolicyRow {
  policy_name: string;
  schema_name: string;
  table_name: string;
  permissive?: boolean | null;
  command?: string | null;
  qual?: string | null;
  roles?: string[] | string | null;
  with_check?: string | null;
}
