import { t } from "@mikro-orm/core";
import {
  Entity,
  PrimaryKey,
  Property,
  ReflectMetadataProvider,
} from "@mikro-orm/decorators/legacy";
import { MikroORM } from "@mikro-orm/postgresql";

import { VectorType } from "../src/property-types/vector.type.js";

@Entity()
class VectorRecord {
  @PrimaryKey({ type: t.integer })
  id!: number;

  @Property({ type: new VectorType(3), nullable: true })
  embedding?: number[];
}

describe("VectorType query conversion", () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      dbName: "vector-query-test",
      entities: [VectorRecord],
      metadataProvider: ReflectMetadataProvider,
    });
  });

  afterAll(async () => {
    await orm?.close();
  });

  it.each([true, false])(
    "should compile an existence query with %s",
    (exists) => {
      const query = orm.em
        .createQueryBuilder(VectorRecord)
        .select("*")
        .where({ embedding: { $exists: exists } });

      expect(query.getQuery()).toContain(
        exists ? '"embedding" is not null' : '"embedding" is null',
      );
      expect(query.getParams()).toEqual([]);
    },
  );

  it("should serialize vector equality operands", () => {
    const query = orm.em
      .createQueryBuilder(VectorRecord)
      .select("*")
      .where({ embedding: { $eq: [1, 2, 3] } });

    expect(query.getParams()).toEqual(["[1,2,3]"]);
  });
});
