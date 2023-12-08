import { MikroORM } from "@mikro-orm/core";
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { DatabaseSeeder } from "../src/database/seeders/DatabaseSeeder";

describe("App (e2e)", () => {
  let app: INestApplication;
  let orm: MikroORM;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    orm = app.get(MikroORM);

    // Get seeder from MikroORM
    const seeder = orm.getSeeder();

    // Refresh the database to start clean (work in mongo too since v5)
    await orm.getSchemaGenerator().refreshDatabase();

    // Seed using a seeder defined by you
    await seeder.seed(DatabaseSeeder);

    await app.init();
  }, 60000);

  it("不指定字段搜索", async () => {
    return await request(app.getHttpServer())
      .get("/posts")
      .query({ query: "error" })
      .expect(200)
      .expect(
        JSON.stringify([
          {
            id: "9ad19a27-457a-4277-ab45-8fea9d585fa2",
            title: "Nemo eum modi vitae nulla voluptas aspernatur.",
            content:
              "Voluptatibus dolores similique. Sint dolores odio reprehenderit atque ab error sed. Porro placeat aliquid assumenda deserunt.",
            createdAt: "2023-07-11T20:39:48.000Z",
            updatedAt: "2023-12-23T07:41:27.000Z",
          },
          {
            id: "96fd54a0-3f58-4c97-abbc-77ae1a2f865a",
            title: "Molestiae atque ex consectetur modi itaque quis.",
            content:
              "Dolore error neque fugiat dolorum atque ut earum hic. Consectetur nisi modi incidunt aperiam vero corrupti odio. Provident quae sit earum excepturi. Non id distinctio consectetur dolorem minus perspiciatis illum corrupti nostrum.",
            createdAt: "2023-08-18T10:48:16.000Z",
            updatedAt: "2023-09-05T23:29:33.000Z",
          },
        ]),
      );
  });

  it("指定字段搜索", async () => {
    return await request(app.getHttpServer())
      .get("/posts")
      .query({ query: "content: error" })
      .expect(200)
      .expect(
        JSON.stringify([
          {
            id: "9ad19a27-457a-4277-ab45-8fea9d585fa2",
            title: "Nemo eum modi vitae nulla voluptas aspernatur.",
            content:
              "Voluptatibus dolores similique. Sint dolores odio reprehenderit atque ab error sed. Porro placeat aliquid assumenda deserunt.",
            createdAt: "2023-07-11T20:39:48.000Z",
            updatedAt: "2023-12-23T07:41:27.000Z",
          },
          {
            id: "96fd54a0-3f58-4c97-abbc-77ae1a2f865a",
            title: "Molestiae atque ex consectetur modi itaque quis.",
            content:
              "Dolore error neque fugiat dolorum atque ut earum hic. Consectetur nisi modi incidunt aperiam vero corrupti odio. Provident quae sit earum excepturi. Non id distinctio consectetur dolorem minus perspiciatis illum corrupti nostrum.",
            createdAt: "2023-08-18T10:48:16.000Z",
            updatedAt: "2023-09-05T23:29:33.000Z",
          },
        ]),
      );
  });

  afterAll(async () => {
    await orm.getSchemaGenerator().dropDatabase();
    await app.close();
  });
});
