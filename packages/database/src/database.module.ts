import {
  Dictionary,
  EntityClass,
  EntityManager,
  MikroORM,
} from "@mikro-orm/core";
import { HealthCheckRegistry } from "@nest-boot/health-check";
import {
  RequestContext,
  RequestContextModule,
} from "@nest-boot/request-context";
import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  Optional,
  Provider,
} from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";

import { DatabaseHealthIndicator } from "./database.health-indicator";
import { DatabaseInterceptor } from "./database.interceptor";
import { DatabaseLogger } from "./database.logger";
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from "./database.module-definition";
import { type DatabaseModuleOptions } from "./interfaces";
import { tryRequire } from "./utils/try-require.util";
import { withBaseConfig } from "./utils/with-base-config.util";

const knex = tryRequire<Dictionary>("@mikro-orm/knex");
const mongo = tryRequire<Dictionary>("@mikro-orm/mongodb");

const providers: Provider[] = [
  Logger,
  {
    provide: MikroORM,
    inject: [MODULE_OPTIONS_TOKEN, Logger],
    useFactory: (options: DatabaseModuleOptions, logger: Logger) => {
      options = withBaseConfig(options);

      return MikroORM.init({
        ...options,
        entities: [...DatabaseModule.entities, ...(options.entities ?? [])],
        context: () => {
          if (RequestContext.isActive()) {
            return RequestContext.get(EntityManager);
          }
        },
        loggerFactory:
          options.debug === true
            ? (options) => new DatabaseLogger(options, logger)
            : undefined,
      });
    },
  },
  {
    provide: EntityManager,
    inject: [MikroORM],
    useFactory: (orm: MikroORM) =>
      new Proxy(orm.em, {
        get(target, property: keyof EntityManager, receiver) {
          if (!RequestContext.isActive()) {
            return Reflect.get(target, property, receiver);
          }

          const instance = RequestContext.get(EntityManager);
          if (!instance) {
            return Reflect.get(target, property, receiver);
          }

          return instance[property];
        },
      }),
  },
  ...(knex
    ? [
        {
          provide: knex.EntityManager,
          inject: [EntityManager],
          useFactory: (em: EntityManager) => em,
        },
      ]
    : []),
  ...(mongo
    ? [
        {
          provide: mongo.EntityManager,
          inject: [EntityManager],
          useFactory: (em: EntityManager) => em,
        },
      ]
    : []),
  DatabaseHealthIndicator,
];

@Global()
@Module({
  imports: [RequestContextModule],
  providers: [
    ...providers,
    {
      provide: APP_INTERCEPTOR,
      useClass: DatabaseInterceptor,
    },
  ],
  exports: providers,
})
export class DatabaseModule
  extends ConfigurableModuleClass
  implements OnModuleInit, OnApplicationShutdown
{
  static entities: EntityClass<any>[] = [];

  static registerEntity(entities: EntityClass<any>[]) {
    this.entities.push(...entities);
  }

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: DatabaseModuleOptions,
    private readonly orm: MikroORM,
    private readonly healthIndicator: DatabaseHealthIndicator,
    @Optional()
    private readonly healthCheckRegistry?: HealthCheckRegistry,
  ) {
    super();
  }

  onModuleInit(): void {
    const healthCheckOptions = this.options.healthCheck;

    if (healthCheckOptions && typeof this.healthCheckRegistry !== "undefined") {
      this.healthCheckRegistry.register(
        async () =>
          await this.healthIndicator.healthCheck(
            "database",
            healthCheckOptions === true ? undefined : healthCheckOptions,
          ),
      );
    }

    RequestContext.registerMiddleware(
      "database",
      (ctx, next) => {
        ctx.set(EntityManager, this.orm.em.fork({ useContext: true }));
        return next();
      },
      ["logger"],
    );
  }

  async onApplicationShutdown() {
    await this.orm.close();
  }
}
