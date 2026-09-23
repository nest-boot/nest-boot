import type { RedisOptions } from "ioredis";

/**
 * Parses a Redis URL into connection options without reading the environment or opening a connection.
 *
 * @param connectionUrl - A Redis connection URL, including optional credentials, port and database
 * @returns Options shared by Redis clients, queues and rate limiters
 */
export function parseRedisUrl(connectionUrl: string): RedisOptions {
  const url = new URL(connectionUrl);
  const port = url.port;
  const database = url.pathname.split("/")[1];
  const host = url.hostname;

  return {
    host: host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host,
    port: port ? +port : undefined,
    db: database ? +database : undefined,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
