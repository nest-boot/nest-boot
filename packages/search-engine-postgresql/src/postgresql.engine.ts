/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import { AnyEntity, FilterQuery, FindOptions } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/postgresql";
import {
  SearchableEntityService,
  SearchableOptions,
  SearchEngineInterface,
} from "@nest-boot/search";
import { SearchOptions } from "@nest-boot/search/dist/interfaces/search-options.interface";
import { Injectable, Scope } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import _ from "lodash";
import { parse } from "search-syntax";
import { Attributes } from "search-syntax/dist/interfaces";

@Injectable({ scope: Scope.TRANSIENT })
export class PostgresqlSearchEngine<T> implements SearchEngineInterface {
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
        if (typeof wrapper.instance?.searchableOptions !== "undefined") {
          const { searchableOptions } = wrapper.instance;

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
    options?: SearchOptions<T>
  ): Promise<[Array<number | string>, number]> {
    const searchable = this.searchableMap.get(index);

    if (typeof searchable === "undefined") {
      throw new Error("Can't find searchable options");
    }

    const { options: searchableOptions } = searchable;

    const metadata = this.entityManager.getMetadata().get(index);

    const repository = this.entityManager.getRepository<AnyEntity>(index);

    const whereGroup: Array<FilterQuery<T>> =
      typeof options?.where !== "undefined" ? [options.where] : [];

    if (typeof query !== "undefined") {
      whereGroup.push(
        parse(query, {
          attributes: _.uniq([
            ...(searchableOptions?.filterableAttributes || []),
            ...(searchableOptions?.searchableAttributes || []),
          ]).reduce<Attributes>((result, field) => {
            const prop = metadata.properties[field];

            if (typeof prop !== "undefined") {
              return {
                ...result,
                [field]: {
                  type: (() => {
                    switch (prop.type) {
                      case "boolean":
                        return "boolean";
                      case "integer":
                      case "smallint":
                      case "tinyint":
                      case "mediumint":
                      case "float":
                      case "double":
                      case "decimal":
                        return "number";
                      case "date":
                      case "time":
                      case "datetime":
                        return "date";
                      case "bigint":
                      case "enum":
                      case "string":
                      case "uuid":
                      case "text":
                      default:
                        return "string";
                    }
                  })(),
                  array: prop.array,
                  fulltext: metadata.indexes.some(
                    ({ type, properties }) =>
                      properties === field && type === "fulltext"
                  ),
                  filterable:
                    searchableOptions?.filterableAttributes?.includes(field),
                  searchable:
                    searchableOptions?.searchableAttributes?.includes(field),
                },
              };
            }

            return result;
          }, {}),
        }) as FilterQuery<T>
      );
    }

    const result = await repository.findAndCount(
      { $and: whereGroup },
      {
        limit: options?.limit,
        offset: options?.offset,
        orderBy: options?.orderBy,
      }
    );

    return [result[0].map(({ id }: { id: string | number }) => id), result[1]];
  }

  async update(index: string, entities: any[]): Promise<void> {}

  async delete(index: string, entities: any[]): Promise<void> {}

  async flush(index: string, entity: any): Promise<void> {}

  async createIndex(index: string, options: SearchableOptions): Promise<void> {}

  async deleteIndex(index: string): Promise<void> {}
}
