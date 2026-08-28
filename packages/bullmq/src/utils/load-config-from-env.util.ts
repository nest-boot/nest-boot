import { ConnectionOptions } from "bullmq";

function normalizeHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }

  return hostname;
}

export function loadConfigFromEnv(): ConnectionOptions {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const port = url.port;
    const database = url.pathname.split("/")[1];

    return {
      host: normalizeHostname(url.hostname),
      port: port ? +port : undefined,
      db: database ? +database : undefined,
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
  }

  return {};
}
