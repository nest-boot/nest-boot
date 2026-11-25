import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { createRedisFixture } from "./redis.fixture.js";

const project = dirname(fileURLToPath(import.meta.url));

/**
 * Runs the schedule test application's CLI in an independent Node process.
 * @param args - CLI arguments.
 * @param connection - Isolated Redis namespace.
 * @param env - Additional process configuration for the scenario.
 * @returns Process, captured output and termination notification.
 */
export function runCli(
  args: string[],
  connection: Awaited<ReturnType<typeof createRedisFixture>>,
  env: NodeJS.ProcessEnv = {},
) {
  const child = spawn(
    process.execPath,
    [resolve(project, "../../command/bin/nb"), ...args],
    {
      cwd: project,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NODE_OPTIONS: "",
        REDIS_URL: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
        SCHEDULE_TEST_PREFIX: connection.prefix,
        ...env,
      },
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });
  const exited = new Promise<number | null>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", resolveExit);
  });
  return { child, output: () => output, exited };
}
