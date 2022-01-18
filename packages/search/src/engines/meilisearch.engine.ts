import { BaseEntity, FindConditions, FindOperator } from "@nest-boot/database";
import { Injectable } from "@nestjs/common";
import { MeiliSearch } from "meilisearch";

import { SearchEngineInterface } from "../interfaces/search-engine.interface";
import { SearchOptions } from "../interfaces/search-options.interface";

@Injectable()
export class MeiliSearchEngine implements SearchEngineInterface {
  constructor(private readonly meilisearch: MeiliSearch) {}

  async search(
    index: string,
    query?: string,
    filter?: string,
    options: SearchOptions = {}
  ): Promise<[BaseEntity["id"][], number]> {
    const whereFilter = options.where && this.getWhereFilter(options.where);

    const response = await this.meilisearch.index(index).search(query, {
      filter: whereFilter ? `(${whereFilter}) AND (${filter})` : filter,
      limit: options.take,
      offset: options.skip,
      sort: options.order
        ? Object.entries(options.order).map(
            ([key, value]) =>
              `${key}:${value === "ASC" || value === 1 ? "asc" : "desc"}`
          )
        : [],
    });
    return [response.hits.map(({ id }) => id), response.nbHits];
  }

  async update(index: string, entities: BaseEntity[]): Promise<void> {
    await this.meilisearch.index(index).addDocuments(entities);
  }

  async delete(index: string, entities: BaseEntity[]): Promise<void> {
    await this.meilisearch
      .index(index)
      .deleteDocuments(entities.map(({ id }) => id));
  }

  async flush(index: string, entity: BaseEntity): Promise<void> {
    await this.meilisearch.index(index).deleteAllDocuments();
  }

  async createIndex(index: string, options) {
    const indexInstance = await this.meilisearch.getOrCreateIndex(index);

    await Promise.all([
      indexInstance.updateFilterableAttributes(options.filterableAttributes),
      indexInstance.updateSortableAttributes(options.sortableAttributes),
    ]);
  }

  async deleteIndex(index: string) {
    await this.meilisearch.deleteIndex(index);
  }

  private getWhereFilter(
    where: FindConditions<BaseEntity> | FindConditions<BaseEntity>[]
  ): string {
    if (where instanceof Array) {
      return where.map((item) => this.getWhereFilter(item)).join(" OR ");
    }

    return (
      Object.entries(where)
        .map(([key, value]) => {
          if (value instanceof FindOperator) {
            switch (value.type) {
              case "lessThan":
                return `${key} < ${value.value}`;
              case "lessThanOrEqual":
                return `${key} <= ${value.value}`;
              case "moreThan":
                return `${key} > ${value.value}`;
              case "moreThanOrEqual":
                return `${key} >= ${value.value}`;
              default:
            }
          }

          return `${key} = ${value}`;
        })
        .join(" AND ") || null
    );
  }
}
