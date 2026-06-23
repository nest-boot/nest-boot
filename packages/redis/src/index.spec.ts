import * as publicApi from "./index.js";
import { RedisModule } from "./redis.module.js";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util.js";

describe("public API", () => {
  it("should export Redis module and config loader", () => {
    expect(publicApi.RedisModule).toBe(RedisModule);
    expect(publicApi.loadConfigFromEnv).toBe(loadConfigFromEnv);
  });
});
