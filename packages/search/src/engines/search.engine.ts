/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import { BaseEntity } from "@nest-boot/database";
import { Injectable } from "@nestjs/common";

import { SearchEngineInterface } from "../interfaces/search-engine.interface";
import { SearchOptions } from "../interfaces/search-options.interface";
import { SearchableOptions } from "../interfaces/searchable-options.interface";

@Injectable()
export class SearchEngine implements SearchEngineInterface {
  async search(
    index: string,
    query?: string,
    filter?: string,
    options?: SearchOptions
  ): Promise<[BaseEntity["id"][], number]> {
    return [[], 0];
  }

  async update(index: string, entities: BaseEntity[]): Promise<void> {}

  async delete(index: string, entities: BaseEntity[]): Promise<void> {}

  async flush(index: string, entity: BaseEntity): Promise<void> {}

  async createIndex(
    index: string,
    options: SearchableOptions<BaseEntity>
  ): Promise<void> {}

  async deleteIndex(index: string): Promise<void> {}
}
