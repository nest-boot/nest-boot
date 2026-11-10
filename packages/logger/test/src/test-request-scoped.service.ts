import { Injectable } from "@nestjs/common";

import { Logger } from "../../dist/index.js";

@Injectable()
export class TestRequestScopedService {
  constructor(readonly logger: Logger) {}
}
