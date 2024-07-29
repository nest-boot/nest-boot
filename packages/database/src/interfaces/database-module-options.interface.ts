import type { Options } from "@mikro-orm/core/utils";

import { DatabaseHealthCheckOptions } from "./database-health-check-options.interface";
import { TransactionOptions } from "./transaction-options.interface";

export interface DatabaseModuleOptions extends Options {
  healthCheck?: boolean | DatabaseHealthCheckOptions;
  transactional?: TransactionOptions;
}
