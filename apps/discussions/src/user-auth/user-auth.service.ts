import { InjectQueue } from "@nest-boot/queue";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";

@Injectable()
export class UserAuthService {
  constructor(@InjectQueue("queue-b") private readonly queue: Queue) {}
}
