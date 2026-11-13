import type { FullTextProperties } from "../types/full-text-properties.type.js";
import { tokenizer } from "./tokenizer.util.js";

/**
 * Builds a native MikroORM onCreate callback that combines source text for FullTextType.
 * @template Entity - Entity containing the source properties.
 * @param properties - One source property name or an array of source property names.
 * @returns Callback producing one lowercase search string, or null if no words remain.
 * @throws {Error} If no source names are provided or the configuration is invalid.
 */
export function onFullTextCreate<Entity extends object>(
  properties: FullTextProperties<Entity>,
): (entity: Entity) => string | null {
  const sources = (
    Array.isArray(properties) ? [...properties] : [properties]
  ) as (keyof Entity & string)[];
  if (sources.length === 0) {
    throw new Error("properties must have at least one property");
  }
  if (
    sources.some(
      (property) => typeof property !== "string" || property.length === 0,
    )
  ) {
    throw new Error(
      "properties must be a property name or an array of property names",
    );
  }

  return (entity) => {
    const words: string[] = [];
    for (const property of sources) {
      const value: unknown = entity[property];
      if (typeof value === "string") {
        for (const word of tokenizer(value)) {
          words.push(word);
        }
      }
    }
    return words.join(" ") || null;
  };
}
