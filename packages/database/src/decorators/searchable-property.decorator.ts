import type { PropertyOptions } from "@mikro-orm/core";
import { Index, Property } from "@mikro-orm/decorators/legacy";
import { FullTextType } from "@mikro-orm/sql";

import type { FullTextProperties } from "../types/full-text-properties.type.js";
import { onFullTextCreate } from "../utils/on-full-text-create.util.js";
import { onFullTextUpdate } from "../utils/on-full-text-update.util.js";

/** Options for a search property derived from other entity properties. */
export interface SearchablePropertyOptions<T extends object> extends Omit<
  PropertyOptions<T>,
  "type" | "index" | "onCreate" | "onUpdate"
> {
  /** Source property name or names to segment into one search string. */
  properties: FullTextProperties<T>;
}

/**
 * Defines a hidden search property maintained on entity creation and source updates.
 * Source text is segmented and combined into one search string.
 * Returns null when none of the sources contain searchable words.
 * Infers the entity type from the decorated class.
 * @template T - Entity containing the source properties.
 * @param options - MikroORM property options and source properties.
 * @param options.properties - Properties whose values should be segmented.
 * @returns MikroORM property decorator.
 * @throws {Error} If no source properties are configured.
 */
export function SearchableProperty<T extends object>({
  properties,
  ...options
}: SearchablePropertyOptions<T>): (
  target: T,
  propertyKey: string | symbol,
) => void {
  const onCreate = onFullTextCreate(properties);
  const onUpdate = onFullTextUpdate(properties);

  return (target, propertyKey: string | symbol) => {
    if (typeof propertyKey !== "string") {
      return;
    }

    Property<T>({
      hidden: true,
      ...options,
      type: FullTextType,
      onCreate,
      onUpdate,
    })(target, propertyKey);
    Index<Record<string, unknown>, string>({ type: "fulltext" })(
      target as Record<string, unknown>,
      propertyKey,
    );
  };
}
