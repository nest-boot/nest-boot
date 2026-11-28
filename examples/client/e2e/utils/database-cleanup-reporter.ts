import { Pool } from "pg";
import {
  getE2eAdminDatabaseUrl,
  getOrCreateE2eDatabaseName,
} from "./server-env";
import type { Reporter } from "@playwright/test/reporter";

class DatabaseCleanupReporter implements Reporter {
  private started = false;

  onBegin(): void {
    this.started = true;
  }

  async onExit(): Promise<void> {
    const databaseName = getOrCreateE2eDatabaseName();
    if (!/^[a-z0-9_]+$/i.test(databaseName)) {
      return;
    }

    const pool = new Pool({ connectionString: getE2eAdminDatabaseUrl() });
    try {
      const { rowCount } = await pool.query(
        "select 1 from pg_database where datname = $1",
        [databaseName],
      );
      if (!rowCount && !this.started) {
        return;
      }
      await pool.query(
        `drop database if exists "${databaseName}" with (force)`,
      );
    } catch (error) {
      if (this.started) {
        console.error(
          `Failed to clean up E2E database ${databaseName}:`,
          error,
        );
      }
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
}

export default DatabaseCleanupReporter;
