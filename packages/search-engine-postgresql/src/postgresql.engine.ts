import { AnyEntity, FilterQuery } from "@mikro-orm/core";
import { EntityManager, SqlEntityRepository } from "@mikro-orm/postgresql";
import {
  SearchableEntityService,
  SearchableOptions,
  SearchEngineInterface,
  SearchOptions,
} from "@nest-boot/search";
import { DiscoveryService } from "@nestjs/core";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import _ from "lodash";
import { parse } from "search-syntax";
import { Attributes } from "search-syntax/dist/interfaces";

export class PostgresqlSearchEngine implements SearchEngineInterface {
  private readonly searchableMap = new Map<
    string,
    { service: SearchableEntityService<AnyEntity>; options: SearchableOptions }
  >();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly entityManager: EntityManager
  ) {
    this.discoveryService
      .getProviders()
      .forEach(
        (wrapper: InstanceWrapper<SearchableEntityService<AnyEntity>>) => {
          if (typeof wrapper.instance?.searchableOptions !== "undefined") {
            const { searchableOptions } = wrapper.instance;

            this.searchableMap.set(searchableOptions.index, {
              service: wrapper.instance,
              options: searchableOptions,
            });
          }
        }
      );
  }

  async search(
    index: string,
    query: string,
    options?: SearchOptions<AnyEntity>
  ): Promise<[Array<number | string>, number]> {
    const searchable = this.searchableMap.get(index);

    if (typeof searchable === "undefined") {
      throw new Error("Can't find searchable options");
    }

    const { options: searchableOptions } = searchable;

    const metadata = this.entityManager.getMetadata().get(index);

    const repository: SqlEntityRepository<AnyEntity> =
      this.entityManager.getRepository<AnyEntity>(index);

    const whereGroup: Array<FilterQuery<AnyEntity>> =
      typeof options?.where !== "undefined" ? [options.where] : [];

    if (typeof query !== "undefined") {
      whereGroup.push(
        parse(query, {
          attributes: _.uniq([
            ...(searchableOptions?.filterableAttributes ?? []),
            ...(searchableOptions?.searchableAttributes ?? []),
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
        }) as FilterQuery<AnyEntity>
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

    return [result[0].map(({ id }) => id), result[1]];
  }
}
