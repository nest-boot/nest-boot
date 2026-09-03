import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import z from "zod";
import { AuthPageShell } from "../components/auth-page-shell";
import { LoginForm } from "../components/login-form";

export const Route = createFileRoute("/auth/login/")({
  component: LoginComponent,
  validateSearch: zodValidator(
    z.object({
      redirect: z.string().optional(),
    }),
  ),
});

function LoginComponent() {
  return (
    <AuthPageShell>
      <LoginForm />
    </AuthPageShell>
  );
}
