import { getRuntime } from "@nest-boot/common";
import { DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule, TypeOrmModuleOptions } from "@nestjs/typeorm";
import { mergeWith } from "lodash";
import { resolve } from "path";
import { SnakeNamingStrategy } from "typeorm-snake-naming-strategy";

import { TransactionalConnection } from "../services/transactional-connection";

@Global()
@Module({})
export class DatabaseModule {
  static register(options?: TypeOrmModuleOptions): DynamicModule {
    const TypeOrmDynamicModule = TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const tsNodeRegistered =
          !!process[Symbol.for("ts-node.register.instance")];

        let connectionOptions = mergeWith(
          {
            type: configService.get("DATABASE_TYPE"),
            host: configService.get("DATABASE_HOST"),
            port: +configService.get("DATABASE_PORT"),
            database: configService.get("DATABASE_NAME"),
            username: configService.get("DATABASE_USERNAME"),
            password: configService.get("DATABASE_PASSWORD"),
            timezone: configService.get("DATABASE_TIMEZONE", "Z"),
            synchronize: configService.get("DATABASE_SYNC") === "true",
            namingStrategy: new SnakeNamingStrategy(),
            entities: [
              tsNodeRegistered
                ? resolve(process.cwd(), "src/app/core/entities/**/*.ts")
                : resolve(process.cwd(), "dist/app/core/entities/**/*.js"),
            ],
            migrations: [
              tsNodeRegistered
                ? resolve(process.cwd(), "src/app/core/migrations/**/*.ts")
                : resolve(process.cwd(), "dist/app/core/migrations/**/*.js"),
            ],
            cli: {
              migrationsDir: resolve(process.cwd(), "src/app/core/migrations"),
            },
          },
          options,
          // eslint-disable-next-line consistent-return
          (a, b) => {
            if (a instanceof Array) {
              return a.concat(b);
            }
          }
        );

        if (getRuntime() === "cli") {
          connectionOptions = {
            ...connectionOptions,
            subscribers: [],
            synchronize: false,
            migrationsRun: false,
            dropSchema: false,
            logging: ["query", "error", "schema"],
          };
        }

        return { ...connectionOptions, autoLoadEntities: true };
      },
    });

    return {
      module: DatabaseModule,
      imports: [TypeOrmDynamicModule],
      providers: [TransactionalConnection],
      exports: [TransactionalConnection],
    };
  }
}
