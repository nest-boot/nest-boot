import type { IdEntity } from "../interfaces/id-entity.interface";

/** Accepts either an entity's ID value or the entity instance itself. */
export type IdOrEntity<Entity extends IdEntity> = Entity["id"] | Entity;
