import type { FilterQuery } from "@mikro-orm/core";
import { parse, type ParseOptions } from "search-syntax";

import type { ConnectionMetadata } from "../interfaces/index.js";

/**
 * Translates the connection's search expression to the validated SQL filter.
 * @param query - The caller's search expression.
 * @param metadata - Filterable fields and the connection's filter schema.
 * @returns The normalized search filter, if any.
 */
export function parseConnectionQuery<Entity extends object>(
  query: string | null | undefined,
  metadata: Pick<
    ConnectionMetadata<Entity>,
    "fieldOptionsMap" | "filterQuerySchema"
  >,
): FilterQuery<Entity> | null {
  if (!query?.trim()) {
    return null;
  }

  const { fieldOptionsMap, filterQuerySchema } = metadata;
  const fields: ParseOptions["fields"] = {};
  for (const [key, options] of fieldOptionsMap) {
    if (options.filterable === true) {
      fields[key] = {
        type: options.type,
        array: options.array,
        searchable: options.searchable,
        ...("fulltext" in options
          ? { fulltext: Boolean(options.fulltext) }
          : {}),
        ...("prefix" in options ? { prefix: options.prefix } : {}),
      };
    }
  }

  const rawFilter = parse(query, { fields });
  return rawFilter === null ? null : filterQuerySchema.parse(rawFilter);
}
