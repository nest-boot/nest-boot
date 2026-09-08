import { Configuration } from "@mikro-orm/core";
import { MikroORM, PgliteConnection, PglitePlatform } from "@mikro-orm/pglite";
import { BasePostgreSqlEntityManager } from "@mikro-orm/sql";

import * as publicApi from "./index.js";
import {
  PgliteRowLevelSecurityConnection,
  PgliteRowLevelSecurityDriver,
} from "./pglite.js";
import {
  RowLevelSecurityConnection,
  RowLevelSecurityDriver,
} from "./postgresql.js";

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
