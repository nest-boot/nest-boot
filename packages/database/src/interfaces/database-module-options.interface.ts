import { type MikroOrmModuleSyncOptions } from "@mikro-orm/nestjs";

import { DatabaseHealthCheckOptions } from "./database-health-check-options.interface";
import { TransactionOptions } from "./transaction-options.interface";

export interface DatabaseModuleOptions extends MikroOrmModuleSyncOptions {
  healthCheck?: boolean | DatabaseHealthCheckOptions;
  transaction?: TransactionOptions;
}
