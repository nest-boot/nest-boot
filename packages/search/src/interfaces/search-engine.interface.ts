import { type EntityManager } from "@mikro-orm/core";

import { type SearchableEntityService } from "../utils/mixin-searchable.util";
import { type SearchOptions } from "./search-options.interface";

export interface SearchEngineInterface<
  E extends { id: number | string | bigint },
  EM extends EntityManager
> {
  search: (
    service: SearchableEntityService<E, EM>,
    query: string,
    options?: SearchOptions<E>
  ) => Promise<[Array<E["id"]>, number]>;
}
