import { Interval } from "@nest-boot/schedule";
import { Injectable } from "@nestjs/common";

@Injectable()
export class TasksService {
  @Interval("100")
  async tick(): Promise<void> {
    await Promise.resolve();
    console.log("TICK");
  }
}
