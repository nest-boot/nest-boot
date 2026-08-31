import {
  Field,
  GraphQLModule,
  ObjectType,
  Query,
  Resolver,
} from "@nest-boot/graphql";
import { Logger, LoggerModule } from "@nest-boot/logger";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { GraphQLLoggerModule } from "../src/index.js";

@ObjectType()
class TestResult {
  @Field(() => String)
  message!: string;
}

@Resolver()
class TestResolver {
  @Query(() => TestResult)
  hello(): TestResult {
    return { message: "world" };
  }
}

interface GraphQLResponse {
  data?: { hello: { message: string } };
  errors?: { message: string }[];
}

describe("GraphQLLoggerModule - e2e", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it("records operation metadata from a real Apollo request", async () => {
    const assign = vi.fn();
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.register({ enabled: false }),
        GraphQLModule.forRoot({
          autoSchemaFile: true,
          graphiql: false,
          path: "/graphql",
        }),
        GraphQLLoggerModule.forRoot({}),
      ],
      providers: [TestResolver],
    })
      .overrideProvider(Logger)
      .useValue({ assign })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer())
      .post("/graphql")
      .send({
        operationName: "HelloOperation",
        query: "query HelloOperation { hello { message } }",
      })
      .expect(200);
    const body = response.body as GraphQLResponse;

    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ hello: { message: "world" } });
    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith({
      operation: {
        id: expect.any(String),
        name: "HelloOperation",
        type: "query",
      },
    });
  });
});
