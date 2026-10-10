import { parseRedisUrl } from "./connection-options.js";

it.each([
  [
    "redis://localhost",
    {
      host: "localhost",
      port: undefined,
      db: undefined,
      username: "",
      password: "",
    },
  ],
  [
    "redis://localhost:6379/0",
    { host: "localhost", port: 6379, db: 0, username: "", password: "" },
  ],
  [
    "rediss://user%40example.com:p%40ss%2Fword@redis.local:6380/2",
    {
      host: "redis.local",
      port: 6380,
      db: 2,
      username: "user@example.com",
      password: "p@ss/word",
      tls: {},
    },
  ],
  [
    "redis://[2001:db8::1]:6379/3",
    { host: "2001:db8::1", port: 6379, db: 3, username: "", password: "" },
  ],
  [
    "rediss://:secret@127.0.0.1/",
    {
      host: "127.0.0.1",
      port: undefined,
      db: undefined,
      username: "",
      password: "secret",
      tls: {},
    },
  ],
] as const)("parses %s", (url, expected) => {
  expect(parseRedisUrl(url)).toEqual(expected);
});

it("does not use or change REDIS_URL", () => {
  const before = process.env.REDIS_URL;
  expect(parseRedisUrl("redis://explicit-host").host).toBe("explicit-host");
  expect(process.env.REDIS_URL).toBe(before);
});

it("preserves invalid URL and credential decoding errors", () => {
  expect(() => parseRedisUrl("not a url")).toThrow(TypeError);
  expect(() => parseRedisUrl("redis://user:%ZZ@localhost")).toThrow(URIError);
});
