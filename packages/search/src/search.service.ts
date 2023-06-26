import { type EntityManager } from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";

import {
  type SearchEngineInterface,
  SearchModuleOptions,
  type SearchOptions,
} from "./interfaces";
import { MODULE_OPTIONS_TOKEN } from "./search.module-definition";
import { type SearchableEntityService } from "./utils/mixin-searchable.util";

@Injectable()
export class SearchService<
  E extends { id: number | string | bigint },
  EM extends EntityManager
> implements SearchEngineInterface<E, EM>
{
  private readonly engine: SearchEngineInterface<E, EM>;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) readonly options: SearchModuleOptions<E, EM>
  ) {
    this.engine = options.engine;
  }

  async search(
    service: SearchableEntityService<E, EM>,
    query: string,
    options?: SearchOptions<E>
  ): Promise<[Array<string | number | bigint>, number]> {
    return await this.engine.search(service, query, options);
  }
}
