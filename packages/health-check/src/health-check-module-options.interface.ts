/** Configuration options for {@link HealthCheckModule}. */
export interface HealthCheckModuleOptions {
  /** HTTP route path, defaulting to `"/health"`. */
  path?: string;

  /**
   * Class decorators applied to the health check controller, defaulting to `[Public()]`.
   *
   * Supports both metadata decorators (such as `Public()` or `SkipThrottle()`) and
   * Nest enhancers (`@UseGuards`, `@UseInterceptors`, `@UsePipes`, `@UseFilters`).
   */
  decorators?: ClassDecorator[];
}
