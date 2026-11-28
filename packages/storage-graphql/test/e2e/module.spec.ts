import { GraphQLModule, Query, Resolver } from "@nest-boot/graphql";
import { StorageModule } from "@nest-boot/storage";
import { type INestApplication, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { StorageGraphQLModule } from "../../src/index.js";

@Resolver()
class TestResolver {
  @Query(() => String)
  test(): string {
    return "ok";
  }
}

@Module({
  imports: [
    StorageModule.forRoot({
      accessKeyId: "access-key",
      bucket: "test-bucket",
      endpointUrl: "http://localhost:9000",
      forcePathStyle: true,
      region: "us-east-1",
      secretAccessKey: "secret-key",
      upload: {
        limits: [{ fileSize: 1024, mimeTypes: ["image/*"] }],
      },
    }),
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      graphiql: false,
      path: "/graphql",
    }),
    StorageGraphQLModule,
  ],
  providers: [TestResolver],
})
class AppModule {}

interface TemporaryFileUploadResponse {
  data?: {
    createTemporaryFileUploadUrls: {
      url: string;
      resourceUrl: string;
      fields: { name: string; value: string }[];
    }[];
  };
  errors?: { message: string }[];
}

describe("StorageGraphQLModule - e2e", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it("creates temporary file upload URLs through a real GraphQL request", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer())
      .post("/graphql")
      .send({
        operationName: "CreateTemporaryFileUploadUrls",
        query: /* GraphQL */ `
          mutation CreateTemporaryFileUploadUrls(
            $input: [TemporaryFileUploadInput!]!
          ) {
            createTemporaryFileUploadUrls(input: $input) {
              url
              resourceUrl
              fields {
                name
                value
              }
            }
          }
        `,
        variables: {
          input: [
            {
              fileSize: 512,
              mimeType: "image/png",
              name: "avatar.png",
            },
          ],
        },
      })
      .expect(200);
    const body = response.body as TemporaryFileUploadResponse;

    expect(body.errors).toBeUndefined();
    expect(body.data?.createTemporaryFileUploadUrls).toHaveLength(1);
    expect(body.data?.createTemporaryFileUploadUrls[0]?.url).toContain(
      "localhost:9000/test-bucket",
    );
    expect(body.data?.createTemporaryFileUploadUrls[0]?.resourceUrl).toContain(
      "http://localhost:9000/test-bucket/tmp/",
    );
    expect(body.data?.createTemporaryFileUploadUrls[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "key" }),
        { name: "Content-Type", value: "image/png" },
      ]),
    );
  });
});
