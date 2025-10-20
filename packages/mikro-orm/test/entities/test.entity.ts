import { Entity, Opt, PrimaryKey, Property } from "@mikro-orm/core";

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

  @PrimaryKey()
  id: number;

  @Property()
  createdAt: Opt<Date> = new Date();

  @Property()
  updatedAt: Opt<Date> = new Date();
}
