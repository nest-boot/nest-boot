import { type EntityName } from "@mikro-orm/core";

import { type SearchOptions } from "./interfaces";

export class SearchEngine {
  // eslint-disable-next-line @typescript-eslint/require-await
  async search<E extends { id: string | number | bigint }>(
    _service: EntityName<E>,
    _query: string,
    _options?: SearchOptions<E>,
  ): Promise<[E["id"][], number]> {
    return [[], 0];
  }
}
