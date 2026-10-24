import {
  EntityProperty,
  Platform,
  Type,
  ValidationError,
} from "@mikro-orm/core";

/**
 * Checks that a value is a non-empty vector of finite numbers.
 * @param value - The value to check
 * @returns Whether the value is a valid numeric vector
 */
function isVector(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  for (const item of value) {
    if (!Number.isFinite(item)) {
      return false;
    }
  }

  return true;
}

/**
 * Custom MikroORM property type for pgvector vector columns with configurable dimensions.
 *
 * Maps number arrays to PostgreSQL vector text using MikroORM's public Type API.
 * Requires the PostgreSQL vector extension; no pgvector Node.js package is needed.
 */
export class VectorType extends Type<
  number[] | null | undefined,
  string | null | undefined
> {
  /**
   * Creates a new VectorType instance.
   * @param dimensions - Optional vector dimension (e.g. 1536 for OpenAI embeddings)
   */
  constructor(private readonly dimensions?: number) {
    super();
  }

  /**
   * Converts a vector to its PostgreSQL text representation.
   * @param value - The vector, null, or undefined
   * @param _platform - The database platform
   * @returns The serialized vector, preserving null and undefined
   * @throws {ValidationError} If the vector is empty or contains non-finite numbers
   */
  convertToDatabaseValue(
    value: number[] | null | undefined,
    _platform: Platform,
  ): string | null | undefined {
    if (value == null) {
      return value;
    }

    if (!isVector(value)) {
      throw ValidationError.invalidType(VectorType, value, "JS");
    }

    return JSON.stringify(value);
  }

  /**
   * Converts PostgreSQL vector text to an array of numbers.
   * @param value - The serialized vector, null, or undefined
   * @param _platform - The database platform
   * @returns The vector, preserving null and undefined
   * @throws {ValidationError} If the database value is not valid vector text
   */
  convertToJSValue(
    value: string | null | undefined,
    _platform: Platform,
  ): number[] | null | undefined {
    if (value == null) {
      return value;
    }

    let vector: unknown;
    try {
      vector = JSON.parse(value);
    } catch {
      throw ValidationError.invalidType(VectorType, value, "database");
    }

    if (!isVector(vector)) {
      throw ValidationError.invalidType(VectorType, value, "database");
    }

    return vector;
  }

  /**
   * Returns the SQL column type for the vector property.
   * @param prop - The entity property metadata
   * @param _platform - The database platform
   * @returns The column type string (e.g. `vector(1536)`)
   * @throws {RangeError} If dimensions are not a positive integer
   */
  getColumnType(
    prop: EntityProperty & { dimensions?: number },
    _platform: Platform,
  ): string {
    const { dimensions } = { dimensions: this.dimensions, ...prop };
    if (dimensions == null) {
      return "vector";
    }

    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new RangeError("Vector dimensions must be a positive integer");
    }

    return `vector(${String(dimensions)})`;
  }
}
