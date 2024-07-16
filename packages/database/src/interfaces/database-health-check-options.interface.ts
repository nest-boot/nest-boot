import { Connection } from "@mikro-orm/core";

export interface DatabaseHealthCheckOptions {
  connection?: Connection;
  timeout?: number;
  checkQuery?: string;
}
