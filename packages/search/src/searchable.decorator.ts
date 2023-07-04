import { type EntityClass } from "@mikro-orm/core";

import { type SearchableOptions } from "./interfaces";
import { SEARCHABLE_OPTIONS } from "./search.constants";

export function Searchable<E>(options: SearchableOptions<E>) {
  return (target: EntityClass<E>) => {
    Reflect.defineMetadata(SEARCHABLE_OPTIONS, options, target);
  };
}
