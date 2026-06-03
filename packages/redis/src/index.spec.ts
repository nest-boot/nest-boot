import * as publicApi from ".";
import { RedisModule } from "./redis.module";
import { loadConfigFromEnv } from "./utils/load-config-from-env.util";

describe("public API", () => {
  it("should export Redis module and config loader", () => {
    expect(publicApi.RedisModule).toBe(RedisModule);
    expect(publicApi.loadConfigFromEnv).toBe(loadConfigFromEnv);
  });
});
