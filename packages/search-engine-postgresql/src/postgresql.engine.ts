import { FilterQuery, FindOptions, GetRepository } from "@mikro-orm/core";
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

export class PostgresqlSearchEngine<T extends { id: number | string | bigint }>
  implements SearchEngineInterface<T>
{
  private readonly searchableMap = new Map<
    string,
    { service: SearchableEntityService<T>; options: SearchableOptions }
  >();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly entityManager: EntityManager
  ) {
    this.discoveryService
      .getProviders()
      .forEach((wrapper: InstanceWrapper<SearchableEntityService<T>>) => {
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
  ): Promise<[Array<T["id"]>, number]> {
    const searchable = this.searchableMap.get(index);

    if (typeof searchable === "undefined") {
      throw new Error("Can't find searchable options");
    }

    const { options: searchableOptions } = searchable;

    const metadata = this.entityManager.getMetadata().get(index);

    const repository: GetRepository<
      T,
      SqlEntityRepository<T>
    > = this.entityManager.getRepository<T>(index);

    let where = options?.where;

    if (typeof query !== "undefined") {
      const queryWhere = parse(query, {
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
                  console.log("prop.type", prop.name, prop.type);

                  switch (prop.type) {
                    case "boolean":
                    case "BooleanType":
                      return "boolean";
                    case "number":
                    case "IntegerType":
                    case "SmallIntType":
                    case "MediumIntType":
                    case "FloatType":
                    case "DoubleType":
                      return "number";
                    case "Date":
                    case "DateType":
                    case "DateTimeType":
                      return "date";
                    case "bigint":
                    case "BigIntType":
                      return "bigint";
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
      }) as FilterQuery<T>;

      if (Object.keys(queryWhere).length !== 0) {
        where = (
          typeof where !== "undefined"
            ? { $and: [where, queryWhere] }
            : queryWhere
        ) as FilterQuery<T> | undefined;
      }
    }

    const findOptions: FindOptions<T> = {
      fields: ["id"],
      limit: options?.limit,
      offset: options?.offset,
      orderBy: options?.orderBy,
    };

    return await Promise.all([
      (typeof where !== "undefined"
        ? repository.find(where, findOptions)
        : repository.findAll(findOptions)
      ).then((items) => items.map((item) => item.id)),
      repository.count(where),
    ]);
  }
}
