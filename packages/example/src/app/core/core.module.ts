import { PersonalAccessToken } from "@nest-boot/auth";
import { DatabaseModule } from "@nest-boot/database";
import { LoggerModule } from "@nest-boot/logger";
import { MailerModule } from "@nest-boot/mailer";
import { QueueModule } from "@nest-boot/queue";
import { RedisModule } from "@nest-boot/redis";
import { SearchModule } from "@nest-boot/search";
import { MeiliSearchEngine } from "@nest-boot/search-engine-meilisearch";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MeiliSearch } from "meilisearch";

import { TestQueue } from "./queues/test.queue";
import { AuthService } from "./services/auth.service";
import { PostService } from "./services/post.service";
import { UserService } from "./services/user.service";

const DatabaseDynamicModule = DatabaseModule.register({
  entities: [PersonalAccessToken],
});

const RedisDynamicModule = RedisModule.registerAsync({
  imports: [],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    host: configService.get("REDIS_HOST", "localhost"),
    port: +configService.get("REDIS_PORT", "6379"),
    username: configService.get("REDIS_USERNAME"),
    password: configService.get("REDIS_PASSWORD"),
    db: +configService.get("REDIS_DB", "0"),
  }),
});

const SearchDynamicModule = SearchModule.registerAsync({
  imports: [DatabaseDynamicModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    engine: new MeiliSearchEngine({
      host: configService.get("MEILISEARCH_HOST"),
      apiKey: configService.get("MEILISEARCH_KEY"),
    }),
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

const services = [AuthService, UserService, PostService];

const queues = [TestQueue];

const providers = [...services, ...queues];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true }),
    LoggerModule.register(),
    RedisDynamicModule,
    SearchDynamicModule,
    MailerDynamicModule,
    QueueDynamicModule,
    DatabaseDynamicModule,
  ],
  providers,
  exports: [...providers],
})
export class CoreModule {}
