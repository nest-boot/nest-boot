import { type DefaultMetricsCollectorConfiguration } from "prom-client";

export interface MetricsModuleOptions
  extends Omit<DefaultMetricsCollectorConfiguration, "register"> {}
