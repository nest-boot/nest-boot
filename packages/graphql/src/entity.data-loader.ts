import { BaseEntity, EntityService } from "@nest-boot/database";
import DataLoader from "dataloader";
import _ from "lodash";
import { In } from "typeorm";

export class EntityDataLoader<T extends BaseEntity> extends DataLoader<
  T["id"],
  T
> {
  constructor(entityService: EntityService<T>) {
    super(async (ids: T["id"][]) => {
      const results = await entityService.findAll({ where: { id: In(ids) } });

      return _.sortBy(results, (result) =>
        _.findIndex(ids, (id) => result.id === id)
      );
    });
  }
}
