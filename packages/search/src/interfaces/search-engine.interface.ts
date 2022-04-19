import { AnyEntity, FindOptions } from "@nest-boot/database";

import { SearchableOptions } from "./searchable-options.interface";

export interface SearchEngineInterface {
  search(
    index: string,
    query?: string,
    filter?: string,
    options?: FindOptions<AnyEntity>
  ): Promise<[AnyEntity["id"][], number]>;

  update(index: string, entities: AnyEntity[]): Promise<void>;

  delete(index: string, entities: AnyEntity[]): Promise<void>;

  flush(index: string, entity: AnyEntity): Promise<void>;

  createIndex(
    index: string,
    options: SearchableOptions<AnyEntity>
  ): Promise<void>;

  deleteIndex(index: string): Promise<void>;
}
