import { MikroORM } from "@mikro-orm/core";
import {
  HealthCheckRegistry,
  type HealthIndicatorResult,
  HealthIndicatorService,
} from "@nest-boot/health-check";
import { Injectable, type OnModuleInit, Optional } from "@nestjs/common";

/** Checks the existing ORM connection and automatically registers database health. */
@Injectable()
export class DatabaseHealthIndicator implements OnModuleInit {
  private readonly healthIndicator = new HealthIndicatorService();
  private pendingCheck?: ReturnType<MikroORM["checkConnection"]>;

  /**
   * Creates the automatically registered database indicator.
   * @param orm - Existing ORM instance
   * @param registry - Optional application health check registry
   */
  constructor(
    private readonly orm: MikroORM,
    @Optional() private readonly registry?: HealthCheckRegistry,
  ) {}

  /** Initializes the existing lazy connection and registers its deferred health check. */
  async onModuleInit(): Promise<void> {
    if (!this.registry) return;

    const connection = this.orm.em.getConnection();
    // MikroORM 7 connects lazily. Initialize once during application startup;
    // probes only report readiness and never initialize or reconnect the ORM.
    await connection.ensureConnection();

    this.registry.register(() => this.pingCheck());
  }

  /**
   * Checks the existing connection without initializing or reconnecting it.
   * @param key - Result key, defaulting to `database`
   * @param timeout - Probe timeout in milliseconds, defaulting to 1,000
   * @returns The database health result
   */
  async pingCheck(
    key = "database",
    timeout = 1000,
  ): Promise<HealthIndicatorResult> {
    return await this.healthIndicator
      .check(key)
      .attempt(async () => {
        // A timeout cannot cancel MikroORM's query. Reuse the pending probe so
        // polling cannot accumulate stalled queries on the shared connection.
        const check = (this.pendingCheck ??= this.orm
          .checkConnection()
          .finally(() => {
            this.pendingCheck = undefined;
          }));
        const result = await check;
        if (!result.ok) throw new Error(result.reason);
      })
      .withTimeout(timeout);
  }
}
