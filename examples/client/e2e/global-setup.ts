import { Pool } from "pg";
import { e2eAdministratorEmail, e2eAdministratorPassword } from "./utils/auth";
import { getE2eDatabaseUrl, getE2eUrls } from "./utils/server-env";

export default async function globalSetup(): Promise<void> {
  const { clientUrl, serverUrl } = getE2eUrls();
  const response = await fetch(`${serverUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: clientUrl,
    },
    body: JSON.stringify({
      email: e2eAdministratorEmail,
      name: "E2E Administrator",
      password: e2eAdministratorPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create the E2E administrator: ${response.status} ${await response.text()}`,
    );
  }

  const pool = new Pool({ connectionString: getE2eDatabaseUrl() });
  try {
    await pool.query(
      `update "user" set roles = array['admin'], email_verified = true where email = $1`,
      [e2eAdministratorEmail],
    );
    const { rows } = await pool.query<{
      email_verified: boolean;
      roles: Array<string> | null;
    }>(`select email_verified, roles from "user" where email = $1`, [
      e2eAdministratorEmail,
    ]);
    const administrator = rows[0];
    if (
      !administrator?.email_verified ||
      !administrator.roles?.includes("admin")
    ) {
      throw new Error("Could not promote the E2E administrator");
    }
  } finally {
    await pool.end();
  }
}
