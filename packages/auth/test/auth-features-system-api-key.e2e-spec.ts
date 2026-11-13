import { verifyAuthFeatures } from "./fixtures/auth-feature-bootstrap.fixture.js";

it.each([
  { admin: true, user: false, owners: ["SystemAccount"] as const },
  { admin: false, user: false, owners: ["SystemAccount"] as const },
  { admin: false, user: true, owners: ["User", "SystemAccount"] as const },
])(
  "enables independent system authentication (admin=$admin, user=$user)",
  async ({ admin, user, owners }) => {
    await verifyAuthFeatures(
      {
        admin: { enabled: admin },
        apiKey: {
          enabled: true,
          system: { enabled: true },
          user: { enabled: user },
        },
      },
      { admin, workspace: false, owners: [...owners] },
    );
  },
  30000,
);
