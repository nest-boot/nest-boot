import {
  type DefaultMetricsCollectorConfiguration,
  type RegistryContentType,
} from "prom-client";

/** Configuration options for the metrics module (Prometheus default metrics collector and endpoint). */
export type MetricsModuleOptions<
  T extends RegistryContentType = RegistryContentType,
> = Omit<DefaultMetricsCollectorConfiguration<T>, "register"> & {
  /** HTTP route path, defaulting to `"/metrics"`. */
  path?: string;

  /**
   * Class decorators applied to the metrics controller, defaulting to `[]`.
   *
   * Supports both metadata decorators (such as `Public()` or `SkipThrottle()`) and
   * Nest enhancers (`@UseGuards`, `@UseInterceptors`, `@UsePipes`, `@UseFilters`).
   */
  decorators?: ClassDecorator[];
};
