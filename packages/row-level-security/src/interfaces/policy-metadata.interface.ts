import { PolicyCommand } from "../enums/policy-command.enum";
import { PolicyMode } from "../enums/policy-mode.enum";

export interface PolicyMetadata {
  name: string;
  mode: PolicyMode;
  command: PolicyCommand;
  using?: string;
  withCheck?: string;
  roles: string[];
  bootstrapSql?: string[];
}

export interface PolicyEntityMetadata {
  entityName: string;
  schemaName: string;
  tableName: string;
  properties?: Record<string, PolicyEntityPropertyMetadata>;
}

export interface PolicyEntityPropertyMetadata {
  fieldName?: string;
  fieldNames?: string[];
  type?: string;
  runtimeType?: string;
  columnTypes?: string[];
  primary?: boolean;
  targetMeta?: PolicyEntityTargetMetadata;
}

export interface PolicyEntityTargetMetadata {
  className?: string;
  name?: string;
  primaryKeys?: string[];
  properties?: Record<string, PolicyEntityPropertyMetadata>;
}

export type PolicyMetadataFactory = (
  entityMetadata: PolicyEntityMetadata,
) => PolicyMetadata;

export type PolicyMetadataEntry = PolicyMetadata | PolicyMetadataFactory;
