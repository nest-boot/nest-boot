import { HealthIndicatorFunction } from "@nestjs/terminus";

export class HealthCheckRegistryService {
  #healthIndicatorFunctions: HealthIndicatorFunction[] = [];

  get healthIndicatorFunctions(): HealthIndicatorFunction[] {
    return this.#healthIndicatorFunctions;
  }

  registerIndicator(
    ...healthIndicatorFunctions: HealthIndicatorFunction[]
  ): void {
    this.#healthIndicatorFunctions.push(...healthIndicatorFunctions);
  }
}
