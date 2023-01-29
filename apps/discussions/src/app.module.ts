import { EntityManager, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
import { LoggerModule } from "@nest-boot/logger";
import { MetricsModule } from "@nest-boot/metrics";
import { QueueDashboardModule, QueueModule } from "@nest-boot/queue";
import { RequestContextModule } from "@nest-boot/request-context";
import { ScheduleModule } from "@nest-boot/schedule";
import { SearchModule } from "@nest-boot/search";
import { PostgresqlSearchEngine } from "@nest-boot/search-engine-postgresql";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DiscoveryService } from "@nestjs/core";

import { CommentModule } from "./comment/comment.module";
import { PostModule } from "./post/post.module";
import { UserModule } from "./user/user.module";
import { UserAuthModule } from "./user-auth/user-auth.module";

const LoggerDynamicModule = LoggerModule.register({});

const ScheduleDynamicModule = ScheduleModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get("REDIS_HOST"),
      port: config.get("REDIS_PORT"),
      username: config.get("REDIS_USERNAME"),
      password: config.get("REDIS_PASSWORD"),
    },
  }),
});

const DatabaseDynamicModule = DatabaseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    driver: PostgreSqlDriver,
    host: config.get("DATABASE_HOST"),
    port: config.get("DATABASE_PORT"),
    dbName: config.get("DATABASE_NAME"),
    name: config.get("DATABASE_USERNAME"),
    password: config.get("DATABASE_PASSWORD"),
  }),
});

const SearchDynamicModule = SearchModule.registerAsync({
  inject: [DiscoveryService, EntityManager],
  useFactory: (
    discoveryService: DiscoveryService,
    entityManager: EntityManager
  ) => ({
    engine: new PostgresqlSearchEngine(discoveryService, entityManager),
  }),
});

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RequestContextModule,
    LoggerDynamicModule,
    MetricsModule,
    ScheduleDynamicModule,
    QueueDashboardModule,
    QueueModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get("REDIS_HOST"),
          port: config.get("REDIS_PORT"),
          username: config.get("REDIS_USERNAME"),
          password: config.get("REDIS_PASSWORD"),
        },
      }),
    }),
    QueueModule.registerAsync({
      name: "queue-b",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get("REDIS_HOST"),
          port: config.get("REDIS_PORT"),
          username: config.get("REDIS_USERNAME"),
          password: config.get("REDIS_PASSWORD"),
        },
      }),
    }),
    DatabaseDynamicModule,
    SearchDynamicModule,
    UserModule,
    UserAuthModule,
    CommentModule,
    PostModule,
  ],
})
export class AppModule {}
