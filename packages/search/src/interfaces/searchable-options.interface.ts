import { EntityField } from "@mikro-orm/core/drivers/IDatabaseDriver";

export interface SearchableOptions<T, P extends string = never> {
  index: string;
  filterableAttributes?: ReadonlyArray<EntityField<T, P>>;
  searchableAttributes?: ReadonlyArray<EntityField<T, P>>;
  sortableAttributes?: ReadonlyArray<EntityField<T, P>>;
}
