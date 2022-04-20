/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import { FilterQuery, FindOptions } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import { Injectable, Scope } from "@nestjs/common";

import {
  SearchEngineInterface,
  SearchableOptions,
  SearchableEntityService,
} from "@nest-boot/search";
import { DiscoveryService } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";

@Injectable({ scope: Scope.TRANSIENT })
export class PostgresqlSearchEngine implements SearchEngineInterface {
  private readonly searchableMap = new Map<
    string,
    { service: SearchableEntityService<any>; options: SearchableOptions }
  >();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly entityManager: EntityManager
  ) {
    this.discoveryService
      .getProviders()
      .forEach((wrapper: InstanceWrapper<SearchableEntityService<any>>) => {
        if (wrapper.instance?.searchableOptions) {
          const searchableOptions = wrapper.instance.searchableOptions;

          this.searchableMap.set(searchableOptions.index, {
            service: wrapper.instance,
            options: searchableOptions,
          });
        }
      });
  }

  async search(
    index: string,
    query: string,
    where?: FilterQuery<any>,
    options?: FindOptions<any>
  ): Promise<[(number | string)[], number]> {
    const searchable = this.searchableMap.get(index);
    if (searchable) {
      const { options: searchableOptions } = searchable;

      const metadata = this.entityManager.getMetadata().get(index);

      const queryBuilder =
        this.entityManager.createQueryBuilder<{ id: string | number }>(index);

      queryBuilder
        .where(where)
        .limit(options?.limit)
        .offset(options?.offset)
        .orderBy(options?.orderBy);

      if (query) {
        queryBuilder.andWhere(
          `to_tsvector(${searchableOptions.searchableAttributes
            .map(
              (name) =>
                metadata.props.find((prop) => prop.name === name)
                  .fieldNames?.[0]
            )
            .filter((name) => name)
            .join(" || ' ' || ")}) @@ to_tsquery(?)`,
          [query]
        );
      }

      const countQueryBuilder = queryBuilder.clone();

      return await Promise.all([
        (async () =>
          (
            await queryBuilder.select("id").getResultList()
          ).map((item) => item.id))(),
        countQueryBuilder.getCount(),
      ]);
    }
  }

  async update(index: string, entities: any[]): Promise<void> {}

  async delete(index: string, entities: any[]): Promise<void> {}

  async flush(index: string, entity: any): Promise<void> {}

  async createIndex(index: string, options: SearchableOptions): Promise<void> {}

  async deleteIndex(index: string): Promise<void> {}
}
