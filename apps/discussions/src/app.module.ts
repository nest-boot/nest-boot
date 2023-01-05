import { EntityManager } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
import { MetricsModule } from "@nest-boot/metrics";
import { RedisModule } from "@nest-boot/redis";
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

const RequestContextDynamicModule = RequestContextModule.registerAsync({
  useFactory: () => ({}),
});

const RedisDynamicModule = RedisModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    host: config.get("REDIS_HOST"),
    port: config.get("REDIS_PORT"),
    username: config.get("REDIS_USERNAME"),
    password: config.get("REDIS_PASSWORD"),
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

const DatabaseDynamicModule = DatabaseModule.forRoot({});

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
    RequestContextDynamicModule,
    MetricsModule,
    RedisDynamicModule,
    ScheduleDynamicModule,
    DatabaseDynamicModule,
    SearchDynamicModule,
    UserModule,
    UserAuthModule,
    CommentModule,
    PostModule,
  ],
})
export class AppModule {}
