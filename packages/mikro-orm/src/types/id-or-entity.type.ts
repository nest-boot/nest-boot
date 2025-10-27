import type { IdEntity } from "../interfaces/id-entity.interface";

export type IdOrEntity<Entity extends IdEntity> = Entity["id"] | Entity;
