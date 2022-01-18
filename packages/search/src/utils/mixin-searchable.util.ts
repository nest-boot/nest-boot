import {
  BaseEntity,
  ChunkByIdOptions,
  DeepPartial,
  EntityService,
  FindConditions,
  In,
} from "@nest-boot/database";
import { Inject, Injectable } from "@nestjs/common";

import { SearchEngine } from "../engines/search.engine";
import { SearchOptions } from "../interfaces/search-options.interface";
import { SearchableOptions } from "../interfaces/searchable-options.interface";
import { SearchQueue } from "../queues/search.queue";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Type<T = any> extends Function {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
}

export interface SearchableEntityService<T extends BaseEntity>
  extends EntityService<T> {
  searchableOptions: SearchableOptions<T>;

  search(
    query?: string,
    filter?: string,
    options?: SearchOptions
  ): Promise<[T[], number]>;
  searchable(conditions: FindConditions<T>): Promise<this>;
  unsearchable(conditions: FindConditions<T>): Promise<this>;
}

export function mixinSearchable<T extends BaseEntity>(
  Base: Type<EntityService<T>>,
  searchableOptions?: SearchableOptions<T>
): Type<SearchableEntityService<T>> {
  @Injectable()
  class SearchableTrait extends Base implements SearchableEntityService<T> {
    @Inject()
    readonly searchQueue: SearchQueue;

    @Inject()
    readonly searchEngine: SearchEngine;

    get searchableOptions(): SearchableOptions<T> {
      return {
        index: searchableOptions?.index || this.repository.metadata.tableName,
        filterableAttributes: searchableOptions?.filterableAttributes || [
          ...this.repository.metadata.columns
            .filter((column) => !column.relationMetadata)
            .map((column) => column.propertyName),
          ...this.repository.metadata.relationIds.map(
            (relationId) => relationId.propertyName
          ),
        ],
        sortableAttributes: searchableOptions?.sortableAttributes || [
          ...this.repository.metadata.columns
            .filter(
              (column) =>
                !column.relationMetadata &&
                [
                  "int",
                  "bigint",
                  "float",
                  "decimal",
                  "timestamp",
                  Number,
                ].includes(column.type as string)
            )
            .map((column) => column.propertyName),
          ...this.repository.metadata.relationIds.map(
            (relationId) => relationId.propertyName
          ),
        ],
      };
    }

    async search(
      query?: string,
      filter?: string,
      options?: SearchOptions
    ): Promise<[T[], number]> {
      const [ids, count] = await this.searchEngine.search(
        this.repository.metadata.tableName,
        query,
        filter,
        options
      );

      return [await this.findAll({ where: { id: In(ids) } }), count];
    }

    async searchable(where: ChunkByIdOptions<T>["where"]) {
      await this.chunkById({ where }, 500, async (entities) => {
        await this.searchQueue.add("makeSearchable", {
          index: this.repository.metadata.tableName,
          entities,
        });
      });

      return this;
    }

    async unsearchable(where: ChunkByIdOptions<T>["where"]) {
      await this.chunkById({ where }, 500, async (entities) => {
        await this.searchQueue.add("unmakeSearchable", {
          index: this.repository.metadata.tableName,
          entities,
        });
      });

      return this;
    }

    async create(input: DeepPartial<T>): Promise<T> {
      const entity = await super.create(input);
      await this.searchable({ id: entity.id });
      return entity;
    }

    async update(
      conditions: FindConditions<T>,
      input: DeepPartial<T>
    ): Promise<this> {
      await super.update(conditions, input);
      await this.searchable(conditions);
      return this;
    }

    async delete(conditions: FindConditions<T>): Promise<this> {
      await this.unsearchable(conditions);
      await super.delete(conditions);
      return this;
    }

    async save(partial: DeepPartial<T>): Promise<T> {
      const entity = await super.save(partial);
      await this.searchable({ id: entity.id });
      return entity;
    }

    async saveAll(partials: DeepPartial<T>[]): Promise<T[]> {
      const entities = await super.saveAll(partials);
      await this.searchable({ id: In(entities.map(({ id }) => id)) });
      return entities;
    }
  }

  return SearchableTrait;
}
