import { loadConfigFromEnv } from "./load-config-from-env.util.js";

const ORIGINAL_ENV = process.env;

describe("loadConfigFromEnv", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.REDIS_URL;
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

  it("should strip brackets from an IPv6 URL hostname", () => {
    process.env.REDIS_URL = "redis://[2001:db8::1]:6379/0";

    expect(loadConfigFromEnv()).toMatchObject({
      host: "2001:db8::1",
      port: 6379,
    });
  });

  it("should return empty config when REDIS_URL is absent", () => {
    expect(loadConfigFromEnv()).toEqual({});
  });
});
