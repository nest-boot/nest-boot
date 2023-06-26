import { type EntityManager } from "@mikro-orm/core";

import { type SearchEngineInterface } from "./search-engine.interface";

export interface SearchModuleOptions<
  E extends { id: string | number | bigint },
  EM extends EntityManager
> {
  isGlobal?: boolean;
  engine: SearchEngineInterface<E, EM>;
}
