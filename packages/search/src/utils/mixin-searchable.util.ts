import { EntityManager, EntityRepository, FilterQuery } from "@mikro-orm/core";
import { EntityService } from "@nest-boot/database";
import { Inject, Injectable } from "@nestjs/common";

import { SearchableOptions, SearchOptions } from "../interfaces";
import { SearchService } from "../search.service";

export type Type<T = any> = new (...args: any[]) => T;

export interface SearchableEntityService<
  T extends { id: number | string | bigint }
> extends EntityService<T> {
  searchableOptions: SearchableOptions;

  search: (query: string, options?: SearchOptions<T>) => Promise<[T[], number]>;
}

export function mixinSearchable<T extends { id: number | string | bigint }>(
  Base: Type<EntityService<T>>,
  searchableOptions: SearchableOptions
): Type<SearchableEntityService<T>> {
  @Injectable()
  class SearchableTrait extends Base implements SearchableEntityService<T> {
    @Inject()
    readonly searchService!: SearchService;

    @Inject()
    readonly entityManager!: EntityManager;

    repository!: EntityRepository<T>;

    get searchableOptions(): SearchableOptions {
      return searchableOptions;
    }

    async search(
      query: string,
      options?: SearchOptions<T>
    ): Promise<[T[], number]> {
      const [ids, count] = await this.searchService.search(
        this.searchableOptions.index,
        query,
        options
      );

      return [
        await this.repository.find(
          { id: { $in: ids } } as unknown as FilterQuery<T>,
          options
        ),
        count,
      ];
    }
  }

  return SearchableTrait;
}
