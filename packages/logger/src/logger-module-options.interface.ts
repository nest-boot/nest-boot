import { type RequestContext } from "@nest-boot/request-context";

export interface LoggerModuleOptions {
  genReqId?: (ctx: RequestContext) => string | Promise<string>;
  // httpAutoLogging?: boolean;
  // graphqlAutoLogging?: boolean;
}
