import { type SearchOptions } from "./search-options.interface";

export interface SearchEngineInterface<
  T extends { id: number | string | bigint } = { id: number | string | bigint }
> {
  search: (
    index: string,
    query: string,
    options?: SearchOptions<T>
  ) => Promise<[Array<T["id"]>, number]>;
}
