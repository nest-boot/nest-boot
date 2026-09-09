import { Configuration } from "@mikro-orm/core";
import { MikroORM, PgliteConnection, PglitePlatform } from "@mikro-orm/pglite";
import { BasePostgreSqlEntityManager } from "@mikro-orm/sql";
import { RequestContext } from "@nest-boot/request-context";

import * as publicApi from "./index.js";
import {
  PgliteRowLevelSecurityConnection,
  PgliteRowLevelSecurityDriver,
} from "./pglite.js";
import {
  RowLevelSecurityConnection,
  RowLevelSecurityDriver,
} from "./postgresql.js";
import {
  RowLevelSecurity,
  RowLevelSecurityMode,
} from "./row-level-security.js";

class CustomEntityManager extends BasePostgreSqlEntityManager<PgliteRowLevelSecurityDriver> {}

describe("PGlite RLS entry point", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([undefined, CustomEntityManager])(
    "preserves the configured entity manager: %s",
    (entityManager) => {
      const configuration = new Configuration(
        { driver: PgliteRowLevelSecurityDriver, entityManager },
        false,
      );
      expect(
        configuration.getDriver().createEntityManager(true),
      ).toBeInstanceOf(entityManager ?? BasePostgreSqlEntityManager);
    },
  );

  it("delegates unscoped queries without starting a transaction or running setup SQL", async () => {
    const execute = vi
      .spyOn(PgliteConnection.prototype, "execute")
      .mockResolvedValue([]);
    const configuration = new Configuration(
      { driver: PgliteRowLevelSecurityDriver },
      false,
    );
    const connection = configuration.getDriver().getConnection();
    const transactional = vi.spyOn(connection, "transactional");

    await expect(connection.execute("select 1")).resolves.toEqual([]);
    expect(transactional).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledExactlyOnceWith(
      "select 1",
      [],
      "all",
      undefined,
      undefined,
    );
  });

  it("uses the PGlite connection, platform, and Nest ORM token", () => {
    const configuration = new Configuration(
      { driver: PgliteRowLevelSecurityDriver },
      false,
    );
    const driver = configuration.getDriver();

    expect(driver.getConnection()).toBeInstanceOf(
      PgliteRowLevelSecurityConnection,
    );
    expect(driver.getConnection()).toBeInstanceOf(PgliteConnection);
    expect(driver.getPlatform()).toBeInstanceOf(PglitePlatform);
    expect(driver.getORMClass()).toBe(MikroORM);
  });

  it("executes role and context statements separately before the query", async () => {
    const execute = vi
      .spyOn(PgliteConnection.prototype, "execute")
      .mockResolvedValue([]);
    const configuration = new Configuration<PgliteRowLevelSecurityDriver>(
      { driver: PgliteRowLevelSecurityDriver },
      false,
    );
    const connection = configuration.getDriver().getConnection();
    const transaction = {};
    const loggerContext = { label: "pglite" };

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RowLevelSecurity.setRole("authenticated");
      RowLevelSecurity.setContext("request_id", "a'; b; c");
      await connection.execute(
        "select ?",
        [1],
        "get",
        transaction,
        loggerContext,
      );
    });

    expect(execute.mock.calls).toEqual([
      ["SET LOCAL ROLE authenticated;", [], "run", transaction, loggerContext],
      [
        "SELECT set_config('app.request_id', 'a''; b; c', true);",
        [],
        "run",
        transaction,
        loggerContext,
      ],
      ["select ?", [1], "get", transaction, loggerContext],
    ]);
  });

  it("clears stale settings separately and avoids resetting an already clean transaction", async () => {
    const execute = vi
      .spyOn(PgliteConnection.prototype, "execute")
      .mockResolvedValue([]);
    const configuration = new Configuration<PgliteRowLevelSecurityDriver>(
      { driver: PgliteRowLevelSecurityDriver },
      false,
    );
    const connection = configuration.getDriver().getConnection();
    const transaction = {};
    const query = () => connection.execute("select 1", [], "all", transaction);

    await RequestContext.run(new RequestContext({ type: "test" }), async () => {
      RowLevelSecurity.setRole("authenticated");
      RowLevelSecurity.setContext("tenant_id", 1);
      RowLevelSecurity.setContext("request_id", "first");
      await query();
      execute.mockClear();

      RowLevelSecurity.clear();
      RowLevelSecurity.setRole("authenticated");
      RowLevelSecurity.setContext("tenant_id", 2);
      await query();
      expect(execute.mock.calls.map(([sql]) => sql)).toEqual([
        "SET LOCAL ROLE authenticated;",
        "SELECT set_config('app.tenant_id', '2', true);",
        "SELECT set_config('app.request_id', null, true);",
        "select 1",
      ]);

      execute.mockClear();
      RowLevelSecurity.setMode(RowLevelSecurityMode.DISABLED);
      await query();
      await query();
      expect(execute.mock.calls.map(([sql]) => sql)).toEqual([
        "SET LOCAL ROLE NONE;",
        "SELECT set_config('app.tenant_id', null, true);",
        "select 1",
        "select 1",
      ]);
    });
  });

  it("exposes both drivers through the root and their own subpaths", () => {
    expect(publicApi.PgliteRowLevelSecurityDriver).toBe(
      PgliteRowLevelSecurityDriver,
    );
    expect(publicApi.PgliteRowLevelSecurityConnection).toBe(
      PgliteRowLevelSecurityConnection,
    );
    expect(publicApi.RowLevelSecurityDriver).toBe(RowLevelSecurityDriver);
    expect(publicApi.RowLevelSecurityConnection).toBe(
      RowLevelSecurityConnection,
    );
  });
});
