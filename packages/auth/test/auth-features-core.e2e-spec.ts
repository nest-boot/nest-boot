import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

describe("core authentication without optional features", () => {
  it.each([
    {},
    {
      admin: { enabled: false },
      apiKey: {
        enabled: false,
        user: { enabled: true },
        workspace: { enabled: true },
      },
    },
    { apiKey: { enabled: true } },
  ])(
    "keeps registration and sessions without implicitly enabling credentials (%j)",
    async (options) => {
      await verifyAuthFeatures(options, {
        admin: false,
        workspace: false,
        owners: [],
      });
    },
    30000,
  );
});
