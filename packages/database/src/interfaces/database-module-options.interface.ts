import { type MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";

import { DatabaseHealthCheckOptions } from "./database-health-check-options.interface";

export interface DatabaseModuleOptions extends MikroOrmModuleSyncOptions {
  healthCheck?: boolean | DatabaseHealthCheckOptions;
}
