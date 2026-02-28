import { EntityProperty, Platform } from "@mikro-orm/core";
import { VectorType as BaseVectorType } from "pgvector/mikro-orm";

/**
 * Custom MikroORM property type for pgvector vector columns with configurable dimensions.
 *
 * @remarks
 * Extends the base pgvector `VectorType` to support specifying the vector
 * dimension at the property level (e.g. `vector(1536)`).
 */
export class VectorType extends BaseVectorType {
  /** Creates a new VectorType instance.
   * @param dimensions - Optional vector dimension (e.g. 1536 for OpenAI embeddings)
   */
  constructor(private readonly dimensions?: number) {
    super();
  }

  /**
   * Returns the SQL column type for the vector property.
   * @param prop - The entity property metadata
   * @param platform - The database platform
   * @returns The column type string (e.g. `vector(1536)`)
   */
  getColumnType(prop: EntityProperty, platform: Platform) {
    return super.getColumnType(
      { dimensions: this.dimensions, ...prop },
      platform,
    );
  }
}
