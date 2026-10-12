import { RequestContext } from "@nest-boot/request-context";
import { Injectable, type OnApplicationShutdown } from "@nestjs/common";

@Injectable()
export class GreetingService implements OnApplicationShutdown {
  readonly prefix = "SOURCE";

  /**
   * Formats a greeting in the command request context.
   * @param name - Name supplied on the command line.
   * @param loud - Whether to uppercase the name.
   * @returns The formatted name.
   */
  format(name: string, loud: boolean): string {
    if (RequestContext.current().type !== "command")
      throw new Error("Missing command context");
    return loud ? name.toUpperCase() : name;
  }

  /** Reports that command application resources were closed. */
  onApplicationShutdown(): void {
    console.log("CLOSED");
  }
}
