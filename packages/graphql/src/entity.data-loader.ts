import { type EntityRepository } from "@mikro-orm/core";
import DataLoader from "dataloader";
import _ from "lodash";

export class EntityDataLoader<T extends { id: string }> extends DataLoader<
  T["id"],
  T
> {
  constructor(repository: EntityRepository<T>) {
    super(async (ids) => {
      const results: T[] = [];

      return _.sortBy(results, (result) =>
        _.findIndex(ids, (id) => result.id === id)
      );
    });
  }
}
