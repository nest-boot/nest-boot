import { randomUUID } from "node:crypto";

import { parseRedisUrl } from "@nest-boot/redis/connection-options";
import { type ConnectionOptions, Queue as BullmqQueue } from "bullmq";

/**
 * Creates a unique Redis prefix, leaving other applications untouched.
 * @returns Connection, prefix and isolated cleanup.
 */
export async function createRedisFixture() {
  const prefix = `queue-test-${randomUUID()}`;
  const connection: ConnectionOptions = parseRedisUrl(
    process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  );
  const options = { connection, prefix };
  const cleanup = new BullmqQueue("fixture", options);
  await cleanup.waitUntilReady();
  return {
    connection,
    prefix,
    options,
    async close() {
      const client = await cleanup.getBackend().client;
      let cursor = "0";
      do {
        const result = await client.scan(cursor, {
          MATCH: `${prefix}:*`,
          COUNT: 1000,
        });
        cursor = result[0];
        if (result[1].length) {
          await client.del(...result[1]);
        }
      } while (cursor !== "0");
      await cleanup.close();
    },
  };
}
