import {
  type FilterQuery,
  type FindOptions,
  type GetRepository,
} from "@mikro-orm/core";
import {
  type EntityManager,
  type SqlEntityRepository,
} from "@mikro-orm/postgresql";
import {
  type SearchableEntityService,
  type SearchableOptions,
  type SearchEngineInterface,
  type SearchOptions,
} from "@nest-boot/search";
import { type DiscoveryService } from "@nestjs/core";
import { type InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import _ from "lodash";
import { parse } from "search-syntax";

export class PostgresqlSearchEngine<T extends { id: number | string | bigint }>
  implements SearchEngineInterface<T>
{
  private readonly searchableMap = new Map<
    string,
    { service: SearchableEntityService<T>; options: SearchableOptions<T> }
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
        fields: _.uniq([
          ...(searchableOptions?.filterableFields ?? []),
          ...(searchableOptions?.searchableFields ?? []),
        ]).reduce((result, field) => {
          const prop = _.get(
            metadata.properties,
            (field as string).split(".").join(".targetMeta.properties.")
          );

          if (typeof prop !== "undefined") {
            return {
              ...result,
              [field as string]: {
                type: (() => {
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
                  searchableOptions?.filterableFields?.includes(field),
                searchable:
                  searchableOptions?.searchableFields?.includes(field),
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

    const limit = 10000;

    return await Promise.all([
      (typeof where !== "undefined"
        ? repository.find(where, findOptions)
        : repository.findAll(findOptions)
      ).then((items) => items.map((item) => item.id)),
      this.entityManager
        .createQueryBuilder(
          typeof where !== "undefined"
            ? this.entityManager
                .createQueryBuilder(index)
                .select("1")
                .andWhere(where)
                .limit(limit)
            : this.entityManager
                .createQueryBuilder(index)
                .select("1")
                .limit(limit)
        )
        .count(),
    ]);
  }
}
