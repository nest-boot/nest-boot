import { INestApplicationContext } from "@nestjs/common";

export interface ScheduleServer extends INestApplicationContext {
  run: () => Promise<void>;
}
