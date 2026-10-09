import { InjectRepository } from "@mikro-orm/nestjs";

import { DatabaseModule } from "./database.module.js";
import { DatabaseHealthIndicator } from "./database-health.indicator.js";
import * as publicApi from "./index.js";

describe("public API", () => {
  it("exports the context-aware database module and upstream helpers", () => {
    expect(publicApi.DatabaseModule).toBe(DatabaseModule);
    expect(publicApi.DatabaseHealthIndicator).toBe(DatabaseHealthIndicator);
    expect(publicApi.InjectRepository).toBe(InjectRepository);
    expect(publicApi).not.toHaveProperty("MikroOrmModule");
  });
});
