import { type EntityManager, type FilterQuery } from "@mikro-orm/core";
import { type EntityService } from "@nest-boot/database";
import { Inject, Injectable } from "@nestjs/common";

import { type SearchableOptions, type SearchOptions } from "../interfaces";
import { SearchService } from "../search.service";

export type Type<T = any> = new (...args: any[]) => T;

export interface SearchableEntityService<
  E extends { id: number | string | bigint },
  EM extends EntityManager
> extends EntityService<E, EM> {
  searchableOptions: SearchableOptions<E>;

  search: (query: string, options?: SearchOptions<E>) => Promise<[E[], number]>;
}

export function mixinSearchable<
  E extends { id: number | string | bigint },
  EM extends EntityManager
>(
  Base: Type<EntityService<E, EM>>,
  searchableOptions: SearchableOptions<E>
): Type<SearchableEntityService<E, EM>> {
  @Injectable()
  class SearchableTrait extends Base implements SearchableEntityService<E, EM> {
    @Inject()
    readonly searchService!: SearchService<E, EM>;

    get searchableOptions(): SearchableOptions<E> {
      return searchableOptions;
    }

    async search(
      query: string,
      options?: SearchOptions<E>
    ): Promise<[E[], number]> {
      const [ids, count] = await this.searchService.search(
        this,
        query,
        options
      );

      return [
        await this.repository.find(
          { id: { $in: ids } } as unknown as FilterQuery<E>,
          options
        ),
        count,
      ];
    }
  }

  return SearchableTrait;
}
