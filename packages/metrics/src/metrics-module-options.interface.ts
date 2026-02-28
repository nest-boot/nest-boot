import {
  type DefaultMetricsCollectorConfiguration,
  RegistryContentType,
} from "prom-client";

/** Configuration options for the metrics module (Prometheus default metrics collector). */
export type MetricsModuleOptions<T extends RegistryContentType> = Omit<
  DefaultMetricsCollectorConfiguration<T>,
  "register"
>;
