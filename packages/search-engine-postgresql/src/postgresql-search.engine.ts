import { type EntityClass, type FilterQuery } from "@mikro-orm/core";
import { type SqlEntityManager } from "@mikro-orm/postgresql";
import {
  type SearchableOptions,
  type SearchEngine,
  type SearchOptions,
} from "@nest-boot/search";
import { SEARCHABLE_OPTIONS } from "@nest-boot/search/dist/search.constants";
import { Injectable } from "@nestjs/common";
import _ from "lodash";
import { parse } from "search-syntax";

import { SearchableEntity } from "./searchable.entity";

@Injectable()
export class PostgresqlSearchEngine implements SearchEngine {
  constructor(private readonly em: SqlEntityManager) {}

  async search<E extends SearchableEntity = SearchableEntity>(
    entityClass: EntityClass<E>,
    query: string,
    options?: SearchOptions<E>,
  ): Promise<[E["id"][], number]> {
    const searchableOptions: SearchableOptions<E> = Reflect.getMetadata(
      SEARCHABLE_OPTIONS,
      entityClass,
    );

    if (typeof searchableOptions === "undefined") {
      throw new Error("Can't find searchable options");
    }

    const metadata = this.em.getMetadata().get(entityClass.name);

    const repository = this.em.getRepository<SearchableEntity>(entityClass);

    let where = options?.where;

    if (typeof query !== "undefined") {
      const queryWhere = parse(query, {
        fields: _.uniq([
          ...(searchableOptions?.filterableFields ?? []),
          ...(searchableOptions?.searchableFields ?? []),
        ]).reduce((result, field) => {
          const prop = _.get(
            metadata.properties,
            (field as string).split(".").join(".targetMeta.properties."),
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
                    properties === field && type === "fulltext",
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
        aliases: searchableOptions?.aliasFields,
      }) as FilterQuery<E>;

      if (Object.keys(queryWhere).length !== 0) {
        where = (
          typeof where !== "undefined"
            ? { $and: [where, queryWhere] }
            : queryWhere
        ) as FilterQuery<E> | undefined;
      }
    }

    const limit = 10000;

    return await Promise.all([
      (typeof where !== "undefined"
        ? repository.find(where, {
            fields: ["id"],
            limit: options?.limit,
            offset: options?.offset,
            orderBy: options?.orderBy,
          })
        : repository.findAll({
            fields: ["id"],
            limit: options?.limit,
            offset: options?.offset,
            orderBy: options?.orderBy,
          })
      ).then((items) => items.map((item) => item.id)),
      this.em
        .createQueryBuilder(
          typeof where !== "undefined"
            ? this.em
                .createQueryBuilder(entityClass)
                .select("1")
                .andWhere(where)
                .limit(limit)
            : this.em.createQueryBuilder(entityClass).select("1").limit(limit),
        )
        .count(),
    ]);
  }
}
