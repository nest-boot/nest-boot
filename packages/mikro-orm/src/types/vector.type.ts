import { EntityProperty, Platform } from "@mikro-orm/core";
import { VectorType as BaseVectorType } from "pgvector/mikro-orm";

export class VectorType extends BaseVectorType {
  constructor(private readonly dimensions?: number) {
    super();
  }

  getColumnType(prop: EntityProperty, platform: Platform) {
    return super.getColumnType(
      { dimensions: this.dimensions, ...prop },
      platform,
    );
  }
}
