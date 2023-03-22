import { INestApplicationContext } from "@nestjs/common";

export interface ScheduleServer extends INestApplicationContext {
  listen: () => Promise<void>;
}
