import type { IdEntity } from "../interfaces/id-entity.interface.js";

/** Accepts either an entity's ID value or the entity instance itself. */
export type IdOrEntity<Entity extends IdEntity> = Entity["id"] | Entity;
