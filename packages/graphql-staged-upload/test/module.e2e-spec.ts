import { GraphQLModule, Query, Resolver } from "@nest-boot/graphql";
import { StagedUploadModule } from "@nest-boot/staged-upload";
import { StorageModule } from "@nest-boot/storage";
import { type INestApplication, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { GraphQLStagedUploadModule } from "../src/index.js";

@Resolver()
class TestResolver {
  @Query(() => String)
  test(): string {
    return "ok";
  }
}

@Module({
  imports: [
    StorageModule.register({
      accessKeyId: "access-key",
      bucket: "test-bucket",
      endpointUrl: "http://localhost:9000",
      forcePathStyle: true,
      region: "us-east-1",
      secretAccessKey: "secret-key",
    }),
    StagedUploadModule.register({
      limits: [{ fileSize: 1024, mimeTypes: ["image/*"] }],
    }),
    GraphQLModule.forRoot({
      autoSchemaFile: true,
      graphiql: false,
      path: "/graphql",
    }),
    GraphQLStagedUploadModule,
  ],
  providers: [TestResolver],
})
class AppModule {}

interface StagedUploadResponse {
  data?: {
    createStagedUploads: {
      fields: { name: string; value: string }[];
      url: string;
    }[];
  };
  errors?: { message: string }[];
}

describe("GraphQLStagedUploadModule - e2e", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it("creates staged upload data through a real GraphQL request", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    const response = await request(app.getHttpServer())
      .post("/graphql")
      .send({
        operationName: "CreateStagedUploads",
        query: /* GraphQL */ `
          mutation CreateStagedUploads($input: [StagedUploadInput!]!) {
            createStagedUploads(input: $input) {
              url
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
    const body = response.body as StagedUploadResponse;

    expect(body.errors).toBeUndefined();
    expect(body.data?.createStagedUploads).toHaveLength(1);
    expect(body.data?.createStagedUploads[0]?.url).toContain(
      "localhost:9000/test-bucket",
    );
    expect(body.data?.createStagedUploads[0]?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "key" }),
        { name: "Content-Type", value: "image/png" },
      ]),
    );
  });
});
