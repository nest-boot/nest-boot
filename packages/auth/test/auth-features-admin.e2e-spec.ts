import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

it.each([
  { admin: { enabled: true } },
  { admin: { enabled: true }, apiKey: { enabled: true } },
  {
    admin: { enabled: true },
    apiKey: { enabled: true, system: { enabled: false } },
  },
  {
    admin: { enabled: true },
    apiKey: { enabled: false, system: { enabled: true } },
  },
])(
  "enables administration without implicitly enabling system credentials (%j)",
  async (options) => {
    await verifyAuthFeatures(options, {
      admin: true,
      workspace: false,
      owners: [],
    });
  },
  30000,
);

it("keeps user credentials independent when administration is enabled without system keys", async () => {
  await verifyAuthFeatures(
    {
      admin: { enabled: true },
      apiKey: { enabled: true, user: { enabled: true } },
    },
    { admin: true, workspace: false, owners: ["User"] },
  );
}, 30000);
