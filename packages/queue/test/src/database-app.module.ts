import { PostgreSqlDriver } from "@mikro-orm/postgresql";
import { DatabaseModule } from "@nest-boot/database";
import { withQueueDatabaseConfig } from "@nest-boot/queue";
import { Module } from "@nestjs/common";

import { AppModule } from "./app.module.js";

@Module({
  imports: [
    AppModule,
    DatabaseModule.forRootAsync({
      driverHint: PostgreSqlDriver,
      useFactory: () =>
        withQueueDatabaseConfig(
          {
            driver: PostgreSqlDriver,
            clientUrl: process.env.QUEUE_DATABASE_URL,
          },
          process.env.QUEUE_TEST_SCHEMA,
        ),
    }),
  ],
})
export class DatabaseAppModule {}
