/** Options for the JWKS endpoint and its signing keys. */
export interface JwksOptions {
  /** HTTP route path, defaulting to `/.well-known/jwks.json`. */
  path?: string;

  /** Optional decorator for the JWKS controller, such as a public-route decorator. */
  controllerDecorator?: ClassDecorator;

  /** Key generation algorithm and parameters, defaulting to EdDSA with Ed25519. */
  keyPairConfig?:
    | { alg: "EdDSA"; crv?: "Ed25519" }
    | { alg: "ES256" | "ES512" }
    | { alg: "PS256" | "RS256"; modulusLength?: number };

  /** How long a key signs new tokens, in seconds. Defaults to 30 days. */
  rotationInterval?: number;

  /** How long an expired signing key can still verify tokens, in seconds. Defaults to 30 days. */
  gracePeriod?: number;
}
