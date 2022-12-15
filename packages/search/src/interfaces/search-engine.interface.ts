import { SearchOptions } from "./search-options.interface";

export interface SearchEngineInterface<
  T extends { id: number | string | bigint } = any
> {
  search: (
    index: string,
    query: string,
    options?: SearchOptions<T>
  ) => Promise<[Array<T["id"]>, number]>;
}
