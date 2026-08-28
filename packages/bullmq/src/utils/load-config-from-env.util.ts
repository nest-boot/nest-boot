import { ConnectionOptions } from "bullmq";

export function loadConfigFromEnv(): ConnectionOptions {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const port = url.port;
    const database = url.pathname.split("/")[1];

    return {
      host: url.hostname,
      port: port ? +port : undefined,
      db: database ? +database : undefined,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }

  return {};
}
