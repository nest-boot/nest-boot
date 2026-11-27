import type { JwtAlgorithm } from "../types/jwt-algorithm.type.js";

/** Options for the JWKS endpoint and its signing keys. */
export interface JwksOptions {
  /** HTTP route path, defaulting to `/.well-known/jwks.json`. */
  path?: string;

  /**
   * Optional metadata decorator for the JWKS controller, such as a public-route decorator.
   * Nest enhancers (`@UseGuards`, `@UseInterceptors`, `@UsePipes`, `@UseFilters`) are not supported.
   */
  controllerDecorator?: ClassDecorator;

  /** Signing key algorithm, defaulting to `"Ed25519"`. */
  alg?: JwtAlgorithm;

  /** How long a key signs new tokens, in seconds. Defaults to 30 days. */
  rotationInterval?: number;

  /** How long an expired signing key can still verify tokens, in seconds. Defaults to 30 days. */
  gracePeriod?: number;
}
