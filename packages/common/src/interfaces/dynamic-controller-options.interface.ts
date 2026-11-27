/** Route and decorator configuration resolved for a dynamic controller. */
export interface DynamicControllerOptions {
  /** Controller route path or paths passed to `@Controller(...)`. */
  path?: string | string[];

  /**
   * Class decorators applied to the generated controller subclass,
   * including metadata decorators (`Public()`, `SkipThrottle()`) and
   * Nest enhancers (`UseGuards()`, `UseInterceptors()`, `UsePipes()`, `UseFilters()`).
   */
  decorators?: ClassDecorator[];
}
