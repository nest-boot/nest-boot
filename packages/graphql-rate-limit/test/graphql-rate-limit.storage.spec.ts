import { BaseContext, GraphQLRequestContext } from "@apollo/server";

import {
  GraphQLRateLimitDriver,
  GraphQLRateLimitDriverInput,
} from "../src/drivers/index.js";
import { GraphQLRateLimitStorage } from "../src/graphql-rate-limit.storage.js";
import { GraphQLRateLimitOptions } from "../src/interfaces/index.js";

describe("GraphQLRateLimitStorage", () => {
  const context = {} as GraphQLRequestContext<BaseContext>;
  const update = vi.fn((_input: GraphQLRateLimitDriverInput) =>
    Promise.resolve({ blocked: false, currentlyAvailable: 80 }),
  );
  const driver = { update } as unknown as GraphQLRateLimitDriver;
  const options: GraphQLRateLimitOptions = {
    maxComplexity: 100,
    defaultComplexity: 0,
    keyPrefix: "graphql-rate-limit",
    restoreRate: 5,
    maximumAvailable: 100,
    getId: () => "client",
  };

  beforeEach(() => {
    update.mockClear();
  });

  it("delegates consumed points to the selected driver", async () => {
    const storage = new GraphQLRateLimitStorage(driver, options);

    await expect(storage.subPoint(context, 20)).resolves.toEqual({
      blocked: false,
      currentlyAvailable: 80,
      maximumAvailable: 100,
      restoreRate: 5,
    });
    expect(update).toHaveBeenCalledWith({
      key: "graphql-rate-limit:client",
      maximumAvailable: 100,
      restoreRate: 5,
      points: 20,
    });
  });

  it("delegates restored points as a negative update", async () => {
    const storage = new GraphQLRateLimitStorage(driver, options);

    await storage.addPoint(context, 20);

    expect(update).toHaveBeenCalledWith({
      key: "graphql-rate-limit:client",
      maximumAvailable: 100,
      restoreRate: 5,
      points: -20,
    });
  });
});
