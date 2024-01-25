import { MikroORM } from "@mikro-orm/core";
import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";

describe("App (e2e)", () => {
  let app: INestApplication;
  let orm: MikroORM;

  const name = "Test";
  const email = "test@example.com";
  const password = "P@ssw0rd";
  let token: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();

    orm = app.get(MikroORM);

    await orm.getSchemaGenerator().refreshDatabase();

    await app.init();
  }, 60000);

  it("Should successfully register a new user", async () => {
    return await request(app.getHttpServer())
      .post("/graphql")
      .send({
        query: /* GraphQL */ `
          mutation Register(
            $name: String!
            $email: String!
            $password: String!
          ) {
            register(name: $name, email: $email, password: $password) {
              id
              name
              email
            }
          }
        `,
        variables: {
          name,
          email,
          password,
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.register.name).toEqual(name);
        expect(res.body.data.register.email).toEqual(email);
      });
  });

  it("Should successfully login and retrieve authentication token", async () => {
    return await request(app.getHttpServer())
      .post("/graphql")
      .send({
        query: /* GraphQL */ `
          mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
              token
            }
          }
        `,
        variables: {
          email,
          password,
        },
      })
      .expect(200)
      .expect((res) => {
        token = res.body.data.login.token;
        expect(typeof res.body.data.login.token).toEqual("string");
      });
  });

  it("Should retrieve user information", async () => {
    return await request(app.getHttpServer())
      .post("/graphql")
      .set("Authorization", `Bearer ${token}`)
      .send({
        query: /* GraphQL */ `
          query GetMeQuery {
            me {
              name
              email
            }
          }
        `,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.data.me.name).toEqual(name);
        expect(res.body.data.me.email).toEqual(email);
      });
  });

  afterAll(async () => {
    // await orm.getSchemaGenerator().dropDatabase();
    await app.close();
  }, 60000);
});
