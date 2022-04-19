import { AnyEntity, EntityRepository } from "@nest-boot/database";
import DataLoader from "dataloader";
import _ from "lodash";

export class EntityDataLoader<T extends { id: string }> extends DataLoader<
  T["id"],
  T
> {
  constructor(repository: EntityRepository<T>) {
    super(async (ids: T["id"][]) => {
      const results = [];

      return _.sortBy(results, (result) =>
        _.findIndex(ids, (id) => result.id === id)
      );
    });
  }
}
