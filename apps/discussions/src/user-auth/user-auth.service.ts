import { Processor } from "@nest-boot/queue";
import { Injectable, Logger, Scope } from "@nestjs/common";

@Injectable({ scope: Scope.REQUEST })
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);

  @Processor("test")
  handle(job: any): void {
    console.log("this", job);
    this.logger.log("handle");
  }
}
