import { AnyEntity, EntityRepository, FindOptions } from "@nest-boot/database";
import { Inject, Injectable } from "@nestjs/common";

import { SearchEngine } from "../engines/search.engine";
import { SearchableOptions } from "../interfaces/searchable-options.interface";
import { SearchQueue } from "../queues/search.queue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Type<T = any> extends Function {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
}

export interface SearchableEntityRepository<T extends AnyEntity>
  extends EntityRepository<T> {
  searchableOptions: SearchableOptions<T>;

  search(
    query?: string,
    filter?: string,
    options?: FindOptions<T>
  ): Promise<[T[], number]>;

  searchable<P extends string = never>(
    options?: FindOptions<T, P>
  ): Promise<this>;

  unsearchable<P extends string = never>(
    options?: FindOptions<T, P>
  ): Promise<this>;
}

export function mixinSearchable<T extends AnyEntity>(
  Base: Type<EntityRepository<T>>,
  searchableOptions?: SearchableOptions<T>
): Type<SearchableEntityRepository<T>> {
  @Injectable()
  class SearchableTrait extends Base implements SearchableEntityRepository<T> {
    searchableOptions: SearchableOptions<T>;
    @Inject()
    readonly searchQueue: SearchQueue;

    @Inject()
    readonly searchEngine: SearchEngine;

    // get searchableOptions(): SearchableOptions<T> {
    //   return {
    //     index: searchableOptions?.index || this.repository.metadata.tableName,
    //     filterableAttributes: searchableOptions?.filterableAttributes || [
    //       ...this.repository.metadata.columns
    //         .filter((column) => !column.relationMetadata)
    //         .map((column) => column.propertyName),
    //       ...this.repository.metadata.relationIds.map(
    //         (relationId) => relationId.propertyName
    //       ),
    //     ],
    //     sortableAttributes: searchableOptions?.sortableAttributes || [
    //       ...this.repository.metadata.columns
    //         .filter(
    //           (column) =>
    //             !column.relationMetadata &&
    //             [
    //               "int",
    //               "bigint",
    //               "float",
    //               "decimal",
    //               "timestamp",
    //               Number,
    //             ].includes(column.type as string)
    //         )
    //         .map((column) => column.propertyName),
    //       ...this.repository.metadata.relationIds.map(
    //         (relationId) => relationId.propertyName
    //       ),
    //     ],
    //   };
    // }

    async search(
      query?: string,
      filter?: string,
      options?: FindOptions<T>
    ): Promise<[T[], number]> {
      // const [ids, count] = await this.searchEngine.search(
      //   this.repository.metadata.tableName,
      //   query,
      //   filter,
      //   options
      // );

      return [[], 0];
    }

    async searchable<P extends string = never>(options?: FindOptions<T, P>) {
      // await this.chunkById({ where }, 500, async (entities) => {
      //   await this.searchQueue.add("makeSearchable", {
      //     index: this.repository.metadata.tableName,
      //     entities,
      //   });
      // });

      return this;
    }

    async unsearchable<P extends string = never>(options?: FindOptions<T, P>) {
      // await this.chunkById({ where }, 500, async (entities) => {
      //   await this.searchQueue.add("unmakeSearchable", {
      //     index: this.repository.metadata.tableName,
      //     entities,
      //   });
      // });

      return this;
    }
  }

  return SearchableTrait;
}
