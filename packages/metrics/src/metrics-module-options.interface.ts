import {
  type DefaultMetricsCollectorConfiguration,
  RegistryContentType,
} from "prom-client";

export type MetricsModuleOptions<T extends RegistryContentType> = Omit<
  DefaultMetricsCollectorConfiguration<T>,
  "register"
>;
