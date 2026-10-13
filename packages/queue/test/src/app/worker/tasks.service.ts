import { Injectable } from "@nestjs/common";

import { Interval } from "../../../../../schedule/dist/index.js";

@Injectable()
export class TasksService {
  @Interval("100")
  async tick(): Promise<void> {
    await Promise.resolve();
    console.log("TICK");
  }
}
