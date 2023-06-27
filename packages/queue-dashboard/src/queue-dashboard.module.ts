import { QueueModule } from "@nest-boot/queue";
import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import path from "path";

import { QueueDashboardController } from "./queue-dashboard.controller";
import { ConfigurableModuleClass } from "./queue-dashboard.module-definition";

@Module({
  imports: [
    QueueModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, "../frontend/dist"),
      serveRoot: "/queue-dashboard",
    }),
  ],
  controllers: [QueueDashboardController],
})
export class QueueDashboardModule extends ConfigurableModuleClass {}
