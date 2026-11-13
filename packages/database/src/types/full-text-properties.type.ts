/** One source property, or source properties to combine into one search string. */
export type FullTextProperties<Entity extends object> =
  | (keyof Entity & string)
  | readonly (keyof Entity & string)[];
