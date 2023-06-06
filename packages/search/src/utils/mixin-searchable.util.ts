import {
  EntityManager,
  type EntityRepository,
  type FilterQuery,
} from "@mikro-orm/core";
import { type EntityService } from "@nest-boot/database";
import { Inject, Injectable } from "@nestjs/common";

import { type SearchableOptions, type SearchOptions } from "../interfaces";
import { SearchService } from "../search.service";

export type Type<T = any> = new (...args: any[]) => T;

export interface SearchableEntityService<
  T extends { id: number | string | bigint }
> extends EntityService<T> {
  searchableOptions: SearchableOptions<T>;

  search: (query: string, options?: SearchOptions<T>) => Promise<T[]>;
}

export function mixinSearchable<T extends { id: number | string | bigint }>(
  Base: Type<EntityService<T>>,
  searchableOptions: SearchableOptions<T>
): Type<SearchableEntityService<T>> {
  @Injectable()
  class SearchableTrait extends Base implements SearchableEntityService<T> {
    @Inject()
    readonly searchService!: SearchService;

    @Inject()
    readonly entityManager!: EntityManager;

    repository!: EntityRepository<T>;

    get searchableOptions(): SearchableOptions<T> {
      return searchableOptions;
    }

    async search(query: string, options?: SearchOptions<T>): Promise<T[]> {
      const ids = await this.searchService.search(
        this.searchableOptions.index,
        query,
        options
      );

      return await this.repository.find(
        { id: { $in: ids } } as unknown as FilterQuery<T>,
        options
      );
    }
  }

  return SearchableTrait;
}
