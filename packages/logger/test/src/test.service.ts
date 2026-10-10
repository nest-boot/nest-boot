import { Injectable } from "@nestjs/common";

import { Logger } from "../../src/index.js";
import { CUSTOM_CONTENT_NAME } from "./constants.js";

@Injectable()
export class TestService {
  defaultContextName?: string;
  customContextName?: string;

  constructor(readonly logger: Logger) {
    this.defaultContextName = this.logger.getContext();

    this.logger.setContext(CUSTOM_CONTENT_NAME);
    this.customContextName = this.logger.getContext();
  }
}
