import type { PropertyOptions } from "@mikro-orm/core";

import type { FullTextProperties } from "../types/full-text-properties.type.js";
import { onFullTextCreate } from "./on-full-text-create.util.js";
import { whenChanged } from "./when-changed.util.js";

/**
 * Builds a native MikroORM onUpdate callback that rebuilds full-text values only when sources change.
 * @template Entity - Entity containing the source properties.
 * @param properties - One source property name or an array of source property names.
 * @returns Callback that preserves the target's current value on unrelated updates.
 * @throws {Error} If configuration is invalid or a required source is unloaded during an update.
 */
export function onFullTextUpdate<Entity extends object>(
  properties: FullTextProperties<Entity>,
): NonNullable<PropertyOptions<Entity>["onUpdate"]> {
  const create = onFullTextCreate(properties);
  const sources = (
    Array.isArray(properties) ? [...properties] : [properties]
  ) as (keyof Entity & string)[];

  return whenChanged(create, sources);
}
