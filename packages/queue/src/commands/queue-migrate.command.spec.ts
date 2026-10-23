import { type PostgresConnectionOptions, runMigrations } from "bullmq";

import { QueueMigrateCommand } from "./queue-migrate.command.js";

const { client, Client } = vi.hoisted(() => {
  const client = { connect: vi.fn(), end: vi.fn() };
  return {
    client,
    Client: vi.fn(function () {
      return client;
    }),
  };
});
vi.mock("pg", () => ({ Client }));
vi.mock("bullmq", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bullmq")>()),
  runMigrations: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(runMigrations).mockResolvedValue(3);
  client.connect.mockResolvedValue(undefined);
  client.end.mockResolvedValue(undefined);
});
/**
 *
 * @param connection - Queue connection settings.
 * @returns A command with captured output.
 */
function command(connection?: PostgresConnectionOptions) {
  const instance = new QueueMigrateCommand({ connection });
  instance.schema = undefined;
  instance.context = {
    ...({} as QueueMigrateCommand["context"]),
    stdout: { write: vi.fn() } as any,
  };
  return instance;
}

it("uses the configured connection and schema and removes BullMQ-only options from pg config", async () => {
  const instance = command({
    connectionString: "postgresql://configured/queue",
    schema: "tasks",
    skipVersionCheck: true,
    migrate: false,
    skipMigrations: true,
    ssl: { rejectUnauthorized: true },
  });
  await instance.execute();
  expect(Client).toHaveBeenCalledWith({
    connectionString: "postgresql://configured/queue",
    ssl: { rejectUnauthorized: true },
  });
  expect(runMigrations).toHaveBeenCalledWith(client, "tasks", {
    skipVersionCheck: true,
  });
  expect(client.end).toHaveBeenCalledOnce();
});
it("uses a connection string and honors the schema flag", async () => {
  const instance = command("postgresql://configured/queue");
  instance.schema = "override";
  await instance.execute();
  expect(Client).toHaveBeenCalledWith({
    connectionString: "postgresql://configured/queue",
  });
  expect(runMigrations).toHaveBeenCalledWith(client, "override", {
    skipVersionCheck: undefined,
  });
});
it("falls back to QUEUE_DATABASE_URL before DATABASE_URL", async () => {
  vi.stubEnv("QUEUE_DATABASE_URL", "postgresql://queue/database");
  vi.stubEnv("DATABASE_URL", "postgresql://app/database");
  try {
    await command().execute();
    expect(Client).toHaveBeenCalledWith({
      connectionString: "postgresql://queue/database",
    });
  } finally {
    vi.unstubAllEnvs();
  }
});
it.each(["connect", "migration"])(
  "closes its client when %s fails",
  async (stage) => {
    if (stage === "connect") {
      client.connect.mockRejectedValue(new Error("failed"));
    } else {
      vi.mocked(runMigrations).mockRejectedValue(new Error("failed"));
    }
    await expect(command().execute()).rejects.toThrow("failed");
    expect(client.end).toHaveBeenCalledOnce();
  },
);
it("checks out a dedicated session and releases it without ending an externally owned pool", async () => {
  const session = { query: vi.fn(), release: vi.fn() };
  const pool = {
    connect: vi.fn().mockResolvedValue(session),
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  await command(pool).execute();
  expect(runMigrations).toHaveBeenCalledWith(session, "bullmq");
  expect(session.release).toHaveBeenCalledOnce();
  expect(pool.end).not.toHaveBeenCalled();
});
