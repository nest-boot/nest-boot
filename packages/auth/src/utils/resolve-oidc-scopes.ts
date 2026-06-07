export function resolveOidcScopes(): string[] {
  return (process.env.AUTH_OIDC_SCOPES ?? "openid,profile,email")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}
