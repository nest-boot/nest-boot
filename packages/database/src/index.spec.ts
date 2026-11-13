import { InjectRepository } from "@mikro-orm/nestjs";

import { DatabaseHealthIndicator } from "./database.health-indicator.js";
import { DatabaseModule } from "./database.module.js";
import { SearchableProperty } from "./decorators/searchable-property.decorator.js";
import * as publicApi from "./index.js";
import { getDatabaseConfig } from "./utils/get-database-config.util.js";
import { onFullTextCreate } from "./utils/on-full-text-create.util.js";
import { onFullTextUpdate } from "./utils/on-full-text-update.util.js";
import { tokenizer } from "./utils/tokenizer.util.js";
import { whenChanged } from "./utils/when-changed.util.js";

describe("public API", () => {
  it("exports the context-aware database module and upstream helpers", () => {
    expect(publicApi.DatabaseModule).toBe(DatabaseModule);
    expect(publicApi.SearchableProperty).toBe(SearchableProperty);
    expect(publicApi.onFullTextCreate).toBe(onFullTextCreate);
    expect(publicApi.onFullTextUpdate).toBe(onFullTextUpdate);
    expect(publicApi.tokenizer).toBe(tokenizer);
    expect(publicApi.whenChanged).toBe(whenChanged);
    expect(publicApi.DatabaseHealthIndicator).toBe(DatabaseHealthIndicator);
    expect(publicApi.InjectRepository).toBe(InjectRepository);
    expect(publicApi.getDatabaseConfig).toBe(getDatabaseConfig);
    expect(publicApi).not.toHaveProperty("loadConfigFromEnv");
    expect(publicApi).not.toHaveProperty("MikroOrmModule");
  });
});
