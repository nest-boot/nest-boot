import { Injectable } from "@nestjs/common";

import { Logger } from "../../src";

@Injectable()
export class TestRequestScopedService {
  constructor(readonly logger: Logger) {}
}
