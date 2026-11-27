/** Route and decorator configuration resolved for a dynamic controller. */
export interface DynamicControllerOptions {
  /** Whether to mount the controller. Defaults to `true`. */
  enabled?: boolean;

  /**
   * Controller route path or paths passed to `@Controller(...)`.
   * When specified, takes precedence over any default path written by decorators in `decorators`.
   */
  path?: string | string[];

  /**
   * Class decorators applied to the generated controller subclass,
   * including metadata decorators (`Public()`, `SkipThrottle()`) and
   * Nest enhancers (`UseGuards()`, `UseInterceptors()`, `UsePipes()`, `UseFilters()`).
   */
  decorators?: ClassDecorator[];
}
