/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import { FilterQuery, FindOptions } from "@mikro-orm/core";
import { Injectable, Scope } from "@nestjs/common";

import { SearchEngineInterface } from "../interfaces/search-engine.interface";
import { SearchableOptions } from "../interfaces/searchable-options.interface";

@Injectable({ scope: Scope.TRANSIENT })
export class SearchEngine implements SearchEngineInterface {
  async search(
    index: string,
    query: string,
    options?: FindOptions<any>
  ): Promise<[Array<number | string>, number]> {
    return [[], 0];
  }

  async update(index: string, entities: any[]): Promise<void> {}

  async delete(index: string, entities: any[]): Promise<void> {}

  async flush(index: string, entity: any): Promise<void> {}

  async createIndex(index: string, options: SearchableOptions): Promise<void> {}

  async deleteIndex(index: string): Promise<void> {}
}
