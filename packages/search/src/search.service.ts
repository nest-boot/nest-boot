import {
  type EntityClass,
  EntityManager,
  type FilterQuery,
} from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";

import { SearchModuleOptions, type SearchOptions } from "./interfaces";
import { MODULE_OPTIONS_TOKEN } from "./search.module-definition";

@Injectable()
export class SearchService {
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: SearchModuleOptions,
    private readonly em: EntityManager
  ) {}

  async search<E extends { id: string | number | bigint }>(
    entityClass: EntityClass<E>,
    query: string,
    options?: SearchOptions<E>
  ): Promise<[E[], number]> {
    const [ids, count] = await this.options.engine.search(
      entityClass,
      query,
      options
    );

    return [
      await this.em.find(
        entityClass,
        { id: { $in: ids } } as unknown as FilterQuery<E>,
        options
      ),
      count,
    ];
  }
}
