import { type EntityName } from "@mikro-orm/core";

import { type SearchOptions } from "./interfaces";

export class SearchEngine {
  async search<E extends { id: string | number | bigint }>(
    service: EntityName<E>,
    query: string,
    options?: SearchOptions<E>
  ): Promise<[Array<E["id"]>, number]> {
    return [[], 0];
  }
}
