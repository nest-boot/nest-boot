import { getDatabaseConfig } from "./get-database-config.util.js";

afterEach(() => vi.unstubAllEnvs());
it("prefers a queue-specific database URL", () => {
  vi.stubEnv("QUEUE_DATABASE_URL", "postgresql://localhost/queue");
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/app");
  expect(getDatabaseConfig()).toEqual({
    connectionString: "postgresql://localhost/queue",
  });
});
it("falls back to the application database", () => {
  vi.stubEnv("QUEUE_DATABASE_URL", undefined);
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/app");
  expect(getDatabaseConfig()).toEqual({
    connectionString: "postgresql://localhost/app",
  });
});
it("falls back to the application database when the queue URL is empty", () => {
  vi.stubEnv("QUEUE_DATABASE_URL", "");
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/app");
  expect(getDatabaseConfig()).toEqual({
    connectionString: "postgresql://localhost/app",
  });
});
it("uses PostgreSQL defaults when neither URL is set", () => {
  vi.stubEnv("QUEUE_DATABASE_URL", undefined);
  vi.stubEnv("DATABASE_URL", undefined);
  expect(getDatabaseConfig()).toEqual({});
});
