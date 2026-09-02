import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.API_URL!,
});
