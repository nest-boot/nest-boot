import {
  type EntityManager,
  type FilterQuery,
  type FindOptions,
  type GetRepository,
} from "@mikro-orm/core";
import {
  type EntityRepository,
  type SqlEntityManager,
} from "@mikro-orm/postgresql";
import {
  type SearchableEntityService,
  type SearchableOptions,
  type SearchEngineInterface,
  type SearchOptions,
} from "@nest-boot/search";
import { Injectable } from "@nestjs/common";
import { type DiscoveryService } from "@nestjs/core";
import { type InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import _ from "lodash";
import { parse } from "search-syntax";

@Injectable()
export class PostgresqlSearchEngine<
  E extends { id: number | string | bigint },
  EM extends EntityManager
> implements SearchEngineInterface<E, EM>
{
  private readonly searchableMap = new Map<string, SearchableOptions<E>>();

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly entityManager: SqlEntityManager
  ) {
    this.discoveryService
      .getProviders()
      .forEach((wrapper: InstanceWrapper<SearchableEntityService<E, EM>>) => {
        if (typeof wrapper.instance?.searchableOptions !== "undefined") {
          const { searchableOptions } = wrapper.instance;

          this.searchableMap.set(
            wrapper.instance.constructor.name,
            searchableOptions
          );
        }
      });
  }

  async search(
    service: SearchableEntityService<E, EM>,
    query: string,
    options?: SearchOptions<E>
  ): Promise<[Array<E["id"]>, number]> {
    const searchableOptions = this.searchableMap.get(service.constructor.name);

    if (typeof searchableOptions === "undefined") {
      throw new Error("Can't find searchable options");
    }

    const entityClassName = searchableOptions.index ?? service.entityClass.name;

    const metadata = this.entityManager.getMetadata().get(entityClassName);

    const repository: GetRepository<
      E,
      EntityRepository<E>
    > = this.entityManager.getRepository<E>(entityClassName);

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
      }) as FilterQuery<E>;

      if (Object.keys(queryWhere).length !== 0) {
        where = (
          typeof where !== "undefined"
            ? { $and: [where, queryWhere] }
            : queryWhere
        ) as FilterQuery<E> | undefined;
      }
    }

    const findOptions: FindOptions<E> = {
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
                .createQueryBuilder(entityClassName)
                .select("1")
                .andWhere(where)
                .limit(limit)
            : this.entityManager
                .createQueryBuilder(entityClassName)
                .select("1")
                .limit(limit)
        )
        .count(),
    ]);
  }
}
