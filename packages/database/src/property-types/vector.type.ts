import { EntityProperty, Platform, Type } from "@mikro-orm/core";
import { vectorFromSql, vectorToSql, vectorType } from "pgvector/utils";

/**
 * Custom MikroORM property type for pgvector vector columns with configurable dimensions.
 *
 * Uses MikroORM's public Type API and pgvector's conversion helpers to support
 * specifying the vector dimension at the property level (e.g. `vector(1536)`).
 */
export class VectorType extends Type<number[] | null, string | null> {
  /**
   * Creates a new VectorType instance.
   * @param dimensions - Optional vector dimension (e.g. 1536 for OpenAI embeddings)
   */
  constructor(private readonly dimensions?: number) {
    super();
  }

  /**
   * Converts a vector to its PostgreSQL text representation.
   * @param value - The vector or null
   * @param _platform - The database platform
   * @returns The serialized vector or null
   */
  convertToDatabaseValue(
    value: number[] | null,
    _platform: Platform,
  ): string | null {
    return vectorToSql(value);
  }

  /**
   * Converts PostgreSQL vector text to an array of numbers.
   * @param value - The serialized vector or null
   * @param _platform - The database platform
   * @returns The vector or null
   */
  convertToJSValue(value: string | null, _platform: Platform): number[] | null {
    return vectorFromSql(value);
  }

  /**
   * Returns the SQL column type for the vector property.
   * @param prop - The entity property metadata
   * @param _platform - The database platform
   * @returns The column type string (e.g. `vector(1536)`)
   */
  getColumnType(
    prop: EntityProperty & { dimensions?: number },
    _platform: Platform,
  ): string {
    return vectorType({ dimensions: this.dimensions, ...prop }.dimensions);
  }
}
