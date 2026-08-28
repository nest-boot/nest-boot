import { loadConfigFromEnv } from "./load-config-from-env.util";

const ORIGINAL_ENV = process.env;

describe("loadConfigFromEnv", () => {
  beforeEach(() => {
    process.env = Object.fromEntries(
      Object.entries(ORIGINAL_ENV).filter(([key]) => !key.startsWith("REDIS_")),
    );
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should load Redis config from TLS URL", () => {
    process.env.REDIS_URL =
      "rediss://user%40example.com:p%40ss%2Fword@redis.local:6380/2";

    expect(loadConfigFromEnv()).toEqual({
      db: 2,
      host: "redis.local",
      password: "p@ss/word",
      port: 6380,
      tls: {},
      username: "user@example.com",
    });
  });

  it("should omit optional URL values when not present", () => {
    process.env.REDIS_URL = "redis://redis.local";

    expect(loadConfigFromEnv()).toEqual({
      db: undefined,
      host: "redis.local",
      password: "",
      port: undefined,
      username: "",
    });
  });

  it("should ignore individual Redis variables", () => {
    process.env.REDIS_HOST = "redis.local";
    process.env.REDIS_PORT = "6379";
    process.env.REDIS_DB = "3";
    process.env.REDIS_DATABASE = "4";
    process.env.REDIS_USER = "user";
    process.env.REDIS_USERNAME = "aliased-user";
    process.env.REDIS_PASS = "pass";
    process.env.REDIS_PASSWORD = "aliased-pass";
    process.env.REDIS_TLS = "false";

    expect(loadConfigFromEnv()).toEqual({});
  });
});
