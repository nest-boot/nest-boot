import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import path from "path";

import { QueueController } from "./queue.controller";
import { ConfigurableModuleClass } from "./queue.module-definition";
import { QueueCoreModule } from "./queue-core.module";

@Module({
  imports: [
    QueueCoreModule,
    ServeStaticModule.forRoot({
      rootPath: path.join(
        path.dirname(
          require.resolve("@nest-boot/queue-dashboard/package.json")
        ),
        "dist"
      ),
      serveRoot: "/queue-dashboard",
    }),
  ],
  controllers: [QueueController],
})
export class QueueDashboardModule extends ConfigurableModuleClass {}
