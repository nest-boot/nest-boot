import { INestApplicationContext } from "@nestjs/common";

export interface QueueServer extends INestApplicationContext {
  run: () => Promise<void>;
}
