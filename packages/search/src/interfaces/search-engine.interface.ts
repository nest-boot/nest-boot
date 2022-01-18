import { BaseEntity } from "@nest-boot/database";

import { SearchOptions } from "./search-options.interface";
import { SearchableOptions } from "./searchable-options.interface";

export interface SearchEngineInterface {
  search(
    index: string,
    query?: string,
    filter?: string,
    options?: SearchOptions
  ): Promise<[BaseEntity["id"][], number]>;

  update(index: string, entities: BaseEntity[]): Promise<void>;

  delete(index: string, entities: BaseEntity[]): Promise<void>;

  flush(index: string, entity: BaseEntity): Promise<void>;

  createIndex(
    index: string,
    options: SearchableOptions<BaseEntity>
  ): Promise<void>;

  deleteIndex(index: string): Promise<void>;
}
