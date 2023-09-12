import { EntityManager, PostgreSqlDriver } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
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
    dbName: config.get("DATABASE_NAME"),
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

@Module({
  imports: [
    ConfigDynamicModule,
    RequestContextModule,
    DatabaseDynamicModule,
    SearchDynamicModule,
    PostModule,
  ],
})
export class AppModule {}
