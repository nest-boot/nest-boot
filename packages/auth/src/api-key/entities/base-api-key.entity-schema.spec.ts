import { createBaseApiKeySchema } from "./base-api-key.entity-schema.js";

describe("createBaseApiKeySchema", () => {
  it("rejects a schema without any enabled credential owner", () => {
    expect(() =>
      createBaseApiKeySchema({ user: false, workspace: false, system: false }),
    ).toThrow("An API-key schema requires at least one enabled owner");
  });
});
