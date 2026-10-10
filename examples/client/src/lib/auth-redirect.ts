const DEFAULT_POST_AUTH_PATH = "/workspaces";

export function resolvePostAuthPath(
  redirect: string | undefined,
  origin: string,
  invitationId?: string | null,
): string {
  if (invitationId) {
    return `/invite?invitationId=${encodeURIComponent(invitationId)}`;
  }

  if (!redirect) return DEFAULT_POST_AUTH_PATH;
  if (redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;

  try {
    const url = new URL(redirect);

    if (url.origin === origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return DEFAULT_POST_AUTH_PATH;
  }

  return DEFAULT_POST_AUTH_PATH;
}

export function createEmailVerificationPagePath(
  email: string,
  redirect: string,
): string {
  const search = new URLSearchParams({ email, redirect });
  return `/auth/verify-email?${search.toString()}`;
}

export function createEmailVerificationCallbackUrl(
  origin: string,
  redirect: string,
): string {
  const url = new URL("/auth/verify-email", origin);
  url.searchParams.set("verified", "true");
  url.searchParams.set("redirect", redirect);
  return url.toString();
}
