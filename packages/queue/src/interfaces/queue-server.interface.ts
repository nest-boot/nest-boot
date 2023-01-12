import { INestApplicationContext } from "@nestjs/common";

export interface QueueServer extends INestApplicationContext {
  start: () => Promise<void>;
}
