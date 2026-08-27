import { Test } from "@nestjs/testing";

import {
  GraphQLRateLimitDriver,
  MemoryGraphQLRateLimitDriver,
} from "../src/drivers";
import { GraphQLRateLimitModule } from "../src/graphql-rate-limit.module";
import { GraphQLRateLimitPlugin } from "../src/graphql-rate-limit.plugin";

describe("GraphQLRateLimitModule", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  afterEach(() => {
    if (originalRedisUrl) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  it("supports direct non-dynamic registration with memory by default", async () => {
    delete process.env.REDIS_URL;
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLRateLimitModule],
    })
      .overrideProvider(GraphQLRateLimitPlugin)
      .useValue({})
      .compile();

    expect(moduleRef.get(GraphQLRateLimitDriver)).toBeInstanceOf(
      MemoryGraphQLRateLimitDriver,
    );

    await moduleRef.close();
  });

  it("registers an explicit custom driver", async () => {
    const close = jest.fn();
    const customDriver = {
      update: jest.fn(),
      close,
    } as unknown as GraphQLRateLimitDriver;
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLRateLimitModule.forRoot({ driver: customDriver })],
    })
      .overrideProvider(GraphQLRateLimitPlugin)
      .useValue({})
      .compile();

    expect(moduleRef.get(GraphQLRateLimitDriver)).toBe(customDriver);

    await moduleRef.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
