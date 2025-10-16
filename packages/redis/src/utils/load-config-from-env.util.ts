import { RedisOptions } from "ioredis";

export function loadConfigFromEnv(): RedisOptions {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const port = url.port;
    const database = url.pathname.split("/")[1];

    return {
      host: url.hostname,
      port: port ? +port : undefined,
      db: database ? +database : undefined,
      username: url.username,
      password: url.password,
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
  const database = process.env.REDIS_DB ?? process.env.REDIS_DATABASE;
  const username = process.env.REDIS_USER ?? process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASS ?? process.env.REDIS_PASSWORD;
  const tls = !!process.env.REDIS_TLS;

  return {
    host,
    ...(port ? { port: +port } : {}),
    ...(database ? { db: +database } : {}),
    username,
    password,
    ...(tls ? { tls: {} } : {}),
  };
}
