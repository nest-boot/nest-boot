import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { SeedManager } from "@mikro-orm/seeder";
import { DatabaseModule } from "@nest-boot/database";
import { GraphQLModule } from "@nest-boot/graphql";
import { GraphqlConnectionModule } from "@nest-boot/graphql-connection";
import { LoggerModule } from "@nest-boot/logger";
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
    extensions: [SeedManager],
  }),
});

const GraphQLDynamicModule = GraphQLModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    playground: true,
    autoSchemaFile: "./schema.gql",
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

const GraphqlConnectionDynamicModule = GraphqlConnectionModule.register();

@Module({
  imports: [
    ConfigDynamicModule,
    LoggerModule,
    DatabaseDynamicModule,
    GraphQLDynamicModule,
    GraphqlConnectionDynamicModule,
    PostModule,
  ],
})
export class AppModule {}
