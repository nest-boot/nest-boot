import { INestApplicationContext } from "@nestjs/common";

export interface ScheduleServer extends INestApplicationContext {
  start: () => Promise<void>;
}
