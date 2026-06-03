import { normalizePostgresTypeAlias } from "./normalize-postgres-type-alias";

describe("normalizePostgresTypeAlias", () => {
  it.each([
    ["bool", "boolean"],
    ["bpchar", "character"],
    ["char", "character"],
    ["decimal", "numeric"],
    ["float4", "real"],
    ["float8", "double precision"],
    ["int", "integer"],
    ["int4", "integer"],
    ["int2", "smallint"],
    ["int8", "bigint"],
    ["timetz", "time with time zone"],
    ["timestamptz", "timestamp with time zone"],
    ["varbit", "bit varying"],
    ["varchar", "character varying"],
    ["varchar(255)", "character varying"],
  ])("normalizes %s to %s", (type, normalizedType) => {
    expect(normalizePostgresTypeAlias(type)).toBe(normalizedType);
  });

  it("preserves canonical PostgreSQL types", () => {
    expect(normalizePostgresTypeAlias("uuid")).toBe("uuid");
  });
});
