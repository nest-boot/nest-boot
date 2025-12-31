import { Entity, Opt, PrimaryKey, Property, t } from "@mikro-orm/core";

@Entity()
export class TestEntity {
  constructor(
    data: Pick<TestEntity, "id"> &
      Partial<Pick<TestEntity, "createdAt" | "updatedAt">>,
  ) {
    this.id = data.id;

    data.createdAt !== void 0 && (this.createdAt = data.createdAt);
    data.updatedAt !== void 0 && (this.updatedAt = data.updatedAt);
  }

  @PrimaryKey({ type: t.integer })
  id: number;

  @Property({ type: t.datetime })
  createdAt: Opt<Date> = new Date();

  @Property({ type: t.datetime })
  updatedAt: Opt<Date> = new Date();
}
