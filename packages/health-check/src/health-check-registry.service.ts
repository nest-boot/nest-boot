import { Injectable } from "@nestjs/common";
import type { HealthIndicatorFunction } from "@nestjs/terminus";

/** Collects health indicators registered by application modules. */
@Injectable()
export class HealthCheckRegistry {
  #healthIndicators: HealthIndicatorFunction[] = [];

  /**
   * Registered indicators, in registration order.
   * @returns Health indicators registered with this registry.
   */
  get healthIndicators(): HealthIndicatorFunction[] {
    return this.#healthIndicators;
  }

  /**
   * Appends health indicators to the shared registry.
   * @param healthIndicators - Checks to execute on each health check request
   */
  register(...healthIndicators: HealthIndicatorFunction[]): void {
    this.#healthIndicators.push(...healthIndicators);
  }
}
