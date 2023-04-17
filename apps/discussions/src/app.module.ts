import { EntityManager, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { AuthModule } from "@nest-boot/auth";
import { DatabaseModule } from "@nest-boot/database";
import { I18nModule } from "@nest-boot/i18n";
import { LoggerModule } from "@nest-boot/logger";
import { MailerModule } from "@nest-boot/mailer";
import { MetricsModule } from "@nest-boot/metrics";
import { QueueDashboardModule, QueueModule } from "@nest-boot/queue";
import { RequestContextModule } from "@nest-boot/request-context";
import { ScheduleModule } from "@nest-boot/schedule";
import { SearchModule } from "@nest-boot/search";
import { PostgresqlSearchEngine } from "@nest-boot/search-engine-postgresql";
import { ViewModule } from "@nest-boot/view";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DiscoveryService } from "@nestjs/core";

import { CommentModule } from "./comment/comment.module";
import { PostModule } from "./post/post.module";
import { UserModule } from "./user/user.module";
import { AccessToken } from "./user-auth/access-token.entity";
import { UserAuthModule } from "./user-auth/user-auth.module";

const LoggerDynamicModule = LoggerModule.register({});

const ViewDynamicModule = ViewModule.register({});

const MailerDynamicModule = MailerModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    host: config.get("SMTP_HOST"),
    port: config.get("SMTP_PORT"),
    auth: {
      user: config.get("SMTP_USERNAME"),
      pass: config.get("SMTP_PASSWORD"),
    },
  }),
});

const I18nDynamicModule = I18nModule.register({
  ns: ["auth"],
});

const AuthDynamicModule = AuthModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    accessTokenEntityClass: AccessToken,
    defaultRequireAuth: true,
  }),
});

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
    RequestContextModule,
    DatabaseDynamicModule,
    I18nDynamicModule,
    AuthDynamicModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ViewDynamicModule,
    MailerDynamicModule,
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
    SearchDynamicModule,
    UserModule,
    UserAuthModule,
    CommentModule,
    PostModule,
  ],
})
export class AppModule {}
