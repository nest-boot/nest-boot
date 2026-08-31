import type { BaseContext, GraphQLRequestContext } from "@apollo/server";
import { Test } from "@nestjs/testing";

import {
  GraphQLRateLimitDriver,
  MemoryGraphQLRateLimitDriver,
} from "../src/drivers/index.js";
import { GraphQLRateLimitModule } from "../src/graphql-rate-limit.module.js";
import { OPTIONS_TOKEN } from "../src/graphql-rate-limit.module-definition.js";
import { GraphQLRateLimitPlugin } from "../src/graphql-rate-limit.plugin.js";
import { GraphQLRateLimitOptions } from "../src/interfaces/index.js";

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

    const options = moduleRef.get<GraphQLRateLimitOptions>(OPTIONS_TOKEN);
    const createContext = (
      ips: string[],
      ip?: string,
    ): GraphQLRequestContext<BaseContext> =>
      ({
        contextValue: { req: { ips, ip } },
      }) as unknown as GraphQLRequestContext<BaseContext>;

    expect(
      options.getId(createContext(["proxy-client"], "direct-client")),
    ).toBe("proxy-client");
    expect(options.getId(createContext([], "direct-client"))).toBe(
      "direct-client",
    );
    expect(() => options.getId(createContext([]))).toThrow(
      "Unable to determine client IP address for rate limiting",
    );

    await moduleRef.close();
  });

  it("registers an explicit custom driver", async () => {
    const close = vi.fn();
    const customDriver = {
      update: vi.fn(),
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

  it("registers an asynchronously supplied custom driver", async () => {
    const customDriver = {
      update: vi.fn(),
      close: vi.fn(),
    } as unknown as GraphQLRateLimitDriver;
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLRateLimitModule.forRootAsync({
          useFactory: () => ({ driver: customDriver }),
        }),
      ],
    })
      .overrideProvider(GraphQLRateLimitPlugin)
      .useValue({})
      .compile();

    expect(moduleRef.get(GraphQLRateLimitDriver)).toBe(customDriver);
    await moduleRef.close();
  });
});
