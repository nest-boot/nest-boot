import { SearchOptions } from "./search-options.interface";

export interface SearchEngineInterface {
  search: (
    index: string,
    query: string,
    options?: SearchOptions<any>
  ) => Promise<[Array<number | string>, number]>;
}
