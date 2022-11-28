import { SearchOptions } from "./search-options.interface";

import { SearchableOptions } from "./searchable-options.interface";

export interface SearchEngineInterface {
  search: (
    index: string,
    query: string,
    options?: SearchOptions<any>
  ) => Promise<[Array<number | string>, number]>;

  update: (index: string, entities: any[]) => Promise<void>;

  delete: (index: string, entities: any[]) => Promise<void>;

  flush: (index: string, entity: any) => Promise<void>;

  createIndex: (index: string, options: SearchableOptions) => Promise<void>;

  deleteIndex: (index: string) => Promise<void>;
}
