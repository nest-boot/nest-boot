import { getRedisConfig } from "./get-redis-config.util.js";
afterEach(() => vi.unstubAllEnvs());
it("loads Redis URL credentials, database and TLS", () => {
  vi.stubEnv("REDIS_URL", "rediss://user:p%40ss@redis.example:6380/2");
  expect(getRedisConfig()).toMatchObject({
    host: "redis.example",
    port: 6380,
    username: "user",
    password: "p@ss",
    db: 2,
    tls: {},
  });
});
it("uses Redis defaults when REDIS_URL is unset", () => {
  vi.stubEnv("REDIS_URL", undefined);
  expect(getRedisConfig()).toEqual({});
});
