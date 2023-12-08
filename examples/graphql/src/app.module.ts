import { EntityManager, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
import { GraphQLModule } from "@nest-boot/graphql";
import { LoggerModule } from "@nest-boot/logger";
import { RequestContextModule } from "@nest-boot/request-context";
import { SearchModule } from "@nest-boot/search";
import { PostgresqlSearchEngine } from "@nest-boot/search-engine-postgresql";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { PostModule } from "./post/post.module";

const ConfigDynamicModule = ConfigModule.forRoot({ isGlobal: true });

const DatabaseDynamicModule = DatabaseModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    driver: PostgreSqlDriver,
    host: config.get("DATABASE_HOST"),
    port: config.get("DATABASE_PORT"),
    dbName: `graphql_${config.get("DATABASE_NAME")}`,
    name: config.get("DATABASE_USERNAME"),
    password: config.get("DATABASE_PASSWORD"),
  }),
});

const SearchDynamicModule = SearchModule.registerAsync({
  inject: [EntityManager],
  useFactory: (entityManager: EntityManager) => ({
    engine: new PostgresqlSearchEngine(entityManager),
  }),
});

const GraphQLDynamicModule = GraphQLModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    playground: true,
    autoSchemaFile: true,
    complexity: {
      rateLimit: {
        connection: {
          host: config.get("REDIS_HOST"),
          port: config.get("REDIS_PORT"),
          password: config.get("REDIS_PASSWORD"),
        },
      },
    },
  }),
});

@Module({
  imports: [
    ConfigDynamicModule,
    LoggerModule,
    RequestContextModule,
    DatabaseDynamicModule,
    SearchDynamicModule,
    GraphQLDynamicModule,
    PostModule,
  ],
})
export class AppModule {}
