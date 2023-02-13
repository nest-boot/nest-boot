import { OnApplicationShutdown } from "@nestjs/common";

import { ConfigurableModuleClass } from "./redis.module-definition";

export class RedisModule
  extends ConfigurableModuleClass
  implements OnApplicationShutdown
{
  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
