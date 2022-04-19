/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
import { AnyEntity, FindOptions } from "@nest-boot/database";
import { Injectable } from "@nestjs/common";

import { SearchEngineInterface } from "../interfaces/search-engine.interface";
import { SearchableOptions } from "../interfaces/searchable-options.interface";

@Injectable()
export class SearchEngine implements SearchEngineInterface {
  async search(
    index: string,
    query?: string,
    filter?: string,
    options?: FindOptions<AnyEntity>
  ): Promise<[AnyEntity["id"][], number]> {
    return [[], 0];
  }

  async update(index: string, entities: AnyEntity[]): Promise<void> {}

  async delete(index: string, entities: AnyEntity[]): Promise<void> {}

  async flush(index: string, entity: AnyEntity): Promise<void> {}

  async createIndex(
    index: string,
    options: SearchableOptions<AnyEntity>
  ): Promise<void> {}

  async deleteIndex(index: string): Promise<void> {}
}
