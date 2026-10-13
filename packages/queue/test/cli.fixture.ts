import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { createPostgresFixture } from "./postgres.fixture.js";

const project = dirname(fileURLToPath(import.meta.url));

/**
 * Runs the committed test application's CLI in an independent Node process.
 * @param args - CLI arguments.
 * @param connection - Isolated test database.
 * @param env - Additional process configuration for the scenario.
 * @returns Process, captured output and termination notification.
 */
export function runCli(
  args: string[],
  connection: Awaited<ReturnType<typeof createPostgresFixture>>["connection"],
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
        QUEUE_DATABASE_URL: connection.connectionString,
        QUEUE_TEST_SCHEMA: connection.schema,
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
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  return { child, output: () => output, exited };
}
