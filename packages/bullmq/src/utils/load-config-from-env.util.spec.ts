import { loadConfigFromEnv } from "./load-config-from-env.util.js";

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

  it("should load Redis config from URL", () => {
    process.env.REDIS_URL = "rediss://user:pass@redis.local:6380/2";

    expect(loadConfigFromEnv()).toEqual({
      db: 2,
      host: "redis.local",
      password: "pass",
      port: 6380,
      tls: {},
      username: "user",
    });
  });

  it("should omit optional URL config when Redis URL does not include it", () => {
    process.env.REDIS_URL = "redis://redis.local";

    expect(loadConfigFromEnv()).toEqual({
      db: undefined,
      host: "redis.local",
      password: "",
      port: undefined,
      username: "",
    });
  });

  it("should load Redis config from host variables", () => {
    process.env.REDIS_HOST = "redis.local";
    process.env.REDIS_PORT = "6379";
    process.env.REDIS_DATABASE = "3";
    process.env.REDIS_USERNAME = "user";
    process.env.REDIS_PASSWORD = "pass";
    process.env.REDIS_TLS = "true";

    expect(loadConfigFromEnv()).toEqual({
      db: 3,
      host: "redis.local",
      password: "pass",
      port: 6379,
      tls: {},
      username: "user",
    });
  });

  it("should omit optional config when environment variables are absent", () => {
    expect(loadConfigFromEnv()).toEqual({
      host: undefined,
      password: undefined,
      username: undefined,
    });
  });
});
