import { LoggerModule } from "@nest-boot/common";
import { DatabaseModule } from "@nest-boot/database";
import { EntityManager } from "@mikro-orm/postgresql";
import { MailerModule } from "@nest-boot/mailer";
import { QueueModule } from "@nest-boot/queue";
import { RedisModule } from "@nest-boot/redis";
import { SearchModule } from "@nest-boot/search";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Post } from "./entities/post.entity";
import { User } from "./entities/user.entity";
import { PostgresqlSearchEngine } from "@nest-boot/search-engine-postgresql";

import { TestQueue } from "./queues/test.queue";
import { PostService } from "./services/post.service";
import { UserService } from "./services/user.service";
import { DiscoveryService } from "@nestjs/core";

const DatabaseDynamicModule = DatabaseModule.forRoot();

const RedisDynamicModule = RedisModule.registerAsync({
  imports: [],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    host: configService.get("REDIS_HOST", "localhost"),
    port: +configService.get("REDIS_PORT", "6379"),
    username: configService.get("REDIS_USERNAME"),
    password: configService.get("REDIS_PASSWORD"),
    db: +configService.get("REDIS_DB", "0"),
    tls: configService.get("REDIS_SSL") === "true" && {
      rejectUnauthorized: false,
    },
  }),
});

const SearchDynamicModule = SearchModule.registerAsync({
  imports: [DatabaseDynamicModule],
  inject: [DiscoveryService, EntityManager],
  useFactory: (
    discoveryService: DiscoveryService,
    entityManager: EntityManager
  ) => ({
    engine: new PostgresqlSearchEngine(discoveryService, entityManager),
  }),
});

const MailerDynamicModule = MailerModule.registerAsync({
  imports: [],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    transport: {
      host: configService.get("MAIL_HOST"),
      port: +configService.get("MAIL_PORT", 587),
      secure: configService.get("MAIL_SECURE") === "true",
      auth: {
        user: configService.get("MAIL_USERNAME"),
        pass: configService.get("MAIL_PASSWORD"),
      },
    },
  }),
});

const QueueDynamicModule = QueueModule.registerAsync({
  imports: [RedisDynamicModule],
});

const services = [PostService, UserService];

const queues = [TestQueue];

const providers = [...services, ...queues];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
    LoggerModule,
    RedisDynamicModule,
    SearchDynamicModule,
    MailerDynamicModule,
    QueueDynamicModule,
    DatabaseDynamicModule,
    DatabaseModule.forFeature([Post, User]),
  ],
  providers,
  exports: [...providers, MailerDynamicModule],
})
export class CoreModule {}
