import { type TestingModule } from "@nestjs/testing";

import * as publicApi from "./index.js";

describe("ViewModule", () => {
  const modules: TestingModule[] = [];
  afterEach(async () => {
    await Promise.all(modules.splice(0).map((module) => module.close()));
  });
  it("does not expose the removed ViewService API", () => {
    expect(publicApi).not.toHaveProperty("ViewService");
  });
});
