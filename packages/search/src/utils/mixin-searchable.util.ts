import {
  AnyEntity,
  EntityManager,
  EntityRepository,
  FilterQuery,
  FindOptions,
} from "@mikro-orm/core";
import { EntityService } from "@nest-boot/database";
import { Inject, Injectable } from "@nestjs/common";

import { SearchEngine } from "../engines/search.engine";
import { SearchableOptions } from "../interfaces/searchable-options.interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Type<T = any> extends Function {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
}

export interface SearchableEntityService<T extends AnyEntity>
  extends EntityService<T> {
  searchableOptions: SearchableOptions;

  search(
    query: string,
    where: FilterQuery<T>,
    options?: FindOptions<T>
  ): Promise<[T[], number]>;
}

export function mixinSearchable<T extends AnyEntity>(
  Base: Type<EntityService<T>>,
  searchableOptions?: SearchableOptions
): Type<SearchableEntityService<T>> {
  @Injectable()
  class SearchableTrait extends Base implements SearchableEntityService<T> {
    @Inject()
    readonly entityManager: EntityManager;

    @Inject()
    readonly searchEngine: SearchEngine;

    repository: EntityRepository<T>;

    get searchableOptions(): SearchableOptions {
      return searchableOptions;
    }

    async search(
      query: string,
      where: FilterQuery<T>,
      options?: FindOptions<T>
    ): Promise<[T[], number]> {
      const [ids, count] = await this.searchEngine.search(
        this.searchableOptions.index,
        query,
        where,
        options
      );

      return [
        await this.repository.find(
          { id: { $in: ids } } as FilterQuery<T>,
          options
        ),
        count,
      ];
    }
  }

  return SearchableTrait;
}
