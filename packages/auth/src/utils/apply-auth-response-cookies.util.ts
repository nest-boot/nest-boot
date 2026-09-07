import { cookies } from "@nest-boot/request-context";
import { parseSetCookie } from "cookie";

/** Applies authentication cookies to the current HTTP response. */
export function applyAuthResponseCookies(responseHeaders: Headers): void {
  const values = responseHeaders.getSetCookie();
  if (values.length === 0) return;

  const cookieStore = cookies();
  for (const value of values) {
    const parsed = parseSetCookie(value);
    cookieStore.set({ ...parsed, value: parsed.value ?? "" });
  }
}
