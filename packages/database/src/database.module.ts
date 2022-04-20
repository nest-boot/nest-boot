import { DynamicModule, Global, Module } from "@nestjs/common";
import { Context } from "@nest-boot/common";
import { ConfigService } from "@nestjs/config";
import { AnyEntity, EntityName } from "@mikro-orm/core";
import {
  MikroOrmModule,
  MikroOrmModuleOptions,
  MikroOrmModuleFeatureOptions,
} from "@mikro-orm/nestjs";
import { resolve } from "path";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    const MikroOrmDynamicModule = MikroOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        let connectionOptions: MikroOrmModuleOptions = {
          type: "postgresql",
          host: configService.get("DATABASE_HOST", "localhost"),
          port: +configService.get("DATABASE_PORT", 5432),
          dbName: configService.get("DATABASE_NAME"),
          name: configService.get("DATABASE_USERNAME"),
          password: configService.get("DATABASE_PASSWORD"),
          metadataProvider: TsMorphMetadataProvider,
          entities: [resolve(process.cwd(), "dist/app/core/entities/**/*.js")],
          entitiesTs: [resolve(process.cwd(), "src/app/core/entities/**/*.ts")],
          context: () => Context.get()?.entityManager,
          debug: true,
        };

        return connectionOptions;
      },
    });

    return {
      global: true,
      module: DatabaseModule,
      imports: [MikroOrmDynamicModule],
      exports: [MikroOrmDynamicModule],
    };
  }

  static forFeature(
    options: EntityName<AnyEntity<any>>[] | MikroOrmModuleFeatureOptions,
    contextName?: string
  ): DynamicModule {
    return MikroOrmModule.forFeature(options, contextName);
  }
}
