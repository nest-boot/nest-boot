import type { JwksOptions } from "./jwks-options.interface.js";

/** Configuration for the standalone JWT module. */
export interface JwtModuleOptions {
  /** JWT issuer. Defaults to AUTH_URL, then APP_URL. */
  issuer?: string;
  /** Secret used to encrypt signing keys. Defaults to JWT_SECRET, then APP_SECRET. */
  secret?: string;
  /** Public JWKS route and signing key lifecycle. */
  jwks?: JwksOptions;
}
