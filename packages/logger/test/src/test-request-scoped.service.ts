import { Injectable } from "@nestjs/common";

import { Logger } from "../../src/index.js";

@Injectable()
export class TestRequestScopedService {
  constructor(readonly logger: Logger) {}
}
