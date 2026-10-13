import { InjectRepository } from "@mikro-orm/nestjs";

import { DatabaseHealthIndicator } from "./database.health-indicator.js";
import { DatabaseModule } from "./database.module.js";
import * as publicApi from "./index.js";
import { getDatabaseConfig } from "./utils/get-database-config.util.js";

describe("public API", () => {
  it("exports the context-aware database module and upstream helpers", () => {
    expect(publicApi.DatabaseModule).toBe(DatabaseModule);
    expect(publicApi.DatabaseHealthIndicator).toBe(DatabaseHealthIndicator);
    expect(publicApi.InjectRepository).toBe(InjectRepository);
    expect(publicApi.getDatabaseConfig).toBe(getDatabaseConfig);
    expect(publicApi).not.toHaveProperty("loadConfigFromEnv");
    expect(publicApi).not.toHaveProperty("MikroOrmModule");
  });
});
