import { type DefaultMetricsCollectorConfiguration } from "prom-client";

export type MetricsModuleOptions = Omit<
  DefaultMetricsCollectorConfiguration,
  "register"
>;
