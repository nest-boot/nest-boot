import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { AuthModule } from "@nest-boot/auth";
import { DatabaseModule } from "@nest-boot/database";
import { GraphQLModule } from "@nest-boot/graphql";
import { GraphQLConnectionModule } from "@nest-boot/graphql-connection";
import { HashModule } from "@nest-boot/hash";
import { HealthCheckModule } from "@nest-boot/health-check";
import { LoggerModule } from "@nest-boot/logger";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { HealthCheckController } from "./health-check/health-check.controller";
import { PersonalAccessToken } from "./personal-access-token/personal-access-token.entity";
import { PersonalAccessTokenModule } from "./personal-access-token/personal-access-token.module";
import { User } from "./user/user.entity";
import { UserModule } from "./user/user.module";

const ConfigDynamicModule = ConfigModule.forRoot({ isGlobal: true });

const DatabaseDynamicModule = DatabaseModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    driver: PostgreSqlDriver,
    host: config.get("DATABASE_HOST"),
    port: config.get("DATABASE_PORT"),
    dbName: config.get<string>("DATABASE_NAME"),
    name: config.get("DATABASE_USERNAME"),
    password: config.get("DATABASE_PASSWORD"),
    transactional: true,
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

export const GraphQLConnectionDynamicModule = GraphQLConnectionModule.register({
  isGlobal: true,
});

const HashDynamicModule = HashModule.registerAsync({
  isGlobal: true,
  useFactory: () => ({}),
});

const AuthDynamicModule = AuthModule.registerAsync({
  isGlobal: true,
  useFactory: () => ({
    entities: {
      User,
      PersonalAccessToken,
    },
  }),
});

@Module({
  imports: [
    HealthCheckModule,
    ConfigDynamicModule,
    LoggerModule,
    AuthDynamicModule,
    DatabaseDynamicModule,
    HashDynamicModule,
    GraphQLDynamicModule,
    GraphQLConnectionDynamicModule,
    UserModule,
    PersonalAccessTokenModule,
  ],
  controllers: [HealthCheckController],
})
export class AppModule {}
