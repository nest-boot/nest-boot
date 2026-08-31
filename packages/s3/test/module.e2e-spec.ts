import { S3Client } from "@aws-sdk/client-s3";
import { type INestApplication, Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { S3Module } from "../src/index.js";

@Injectable()
class S3Consumer {
  constructor(readonly client: S3Client) {}
}

@Module({ providers: [S3Consumer], exports: [S3Consumer] })
class FeatureModule {}

@Module({
  imports: [
    S3Module.registerAsync({
      useFactory: () =>
        Promise.resolve({
          region: "ap-southeast-1",
        }),
    }),
    FeatureModule,
  ],
})
class AppModule {}

describe("S3Module integration", () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it("provides one global S3 client to feature modules", async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();

    const client = app.get(S3Client);
    const consumer = app.get(S3Consumer);

    expect(consumer.client).toBe(client);
    await expect(client.config.region()).resolves.toBe("ap-southeast-1");
  });
});
