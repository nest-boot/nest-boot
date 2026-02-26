import {
  type DefaultMetricsCollectorConfiguration,
  RegistryContentType,
} from "prom-client";

/**
 * Options for configuring the MetricsModule.
 * Extends DefaultMetricsCollectorConfiguration from prom-client.
 */
export type MetricsModuleOptions<T extends RegistryContentType> = Omit<
  DefaultMetricsCollectorConfiguration<T>,
  "register"
>;
