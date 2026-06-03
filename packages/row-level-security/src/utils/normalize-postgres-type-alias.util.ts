export function normalizePostgresTypeAlias(postgresType: string) {
  const normalized = postgresType.trim().toLowerCase().replace(/\s+/g, " ");
  const baseType = normalized.replace(/\s*\([^)]*\)\s*$/, "");

  switch (baseType) {
    case "bool":
      return "boolean";
    case "bpchar":
    case "char":
      return "character";
    case "decimal":
      return "numeric";
    case "float4":
      return "real";
    case "float8":
      return "double precision";
    case "int":
    case "int4":
      return "integer";
    case "int2":
      return "smallint";
    case "int8":
      return "bigint";
    case "timetz":
      return "time with time zone";
    case "timestamptz":
      return "timestamp with time zone";
    case "varbit":
      return "bit varying";
    case "varchar":
      return "character varying";
    default:
      return postgresType;
  }
}
