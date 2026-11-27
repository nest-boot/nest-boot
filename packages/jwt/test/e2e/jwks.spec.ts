import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import {
  type CanActivate,
  type INestApplication,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { decodeJwt, decodeProtectedHeader } from "jose";

import { JwksController } from "../../src/controllers/jwks.controller.js";
import { Jwk } from "../../src/entities/jwk.entity.js";
import type { JwtModuleOptions } from "../../src/interfaces/jwt-module-options.interface.js";
import { JwtModule } from "../../src/jwt.module.js";
import { JwtService } from "../../src/services/jwt.service.js";
import { resolveJwksOptions } from "../../src/utils/resolve-jwks-options.js";

class DenyGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}

/**
 * Encodes an unsigned compact JWT carrying an arbitrary header for parser tests.
 * @param header - Raw JWT header fields.
 * @returns Compact JWT string with a placeholder signature.
 */
function forgeTokenHeader(header: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode(header)}.${encode({ sub: "user:1", exp: 9_999_999_999 })}.c2lnbmF0dXJl`;
}

describe("standalone JWT module", () => {
  let app: INestApplication;
  const secret =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

  beforeEach(() => {
    vi.stubEnv("AUTH_URL", undefined);
    vi.stubEnv("APP_URL", undefined);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it.each([false, true])(
    "uses the configured JWKS controller path and metadata decorator (async options: %s)",
    async (asyncOptions) => {
      const path = "/keys/public.json";
      let isPublicMetadata: unknown;
      const url = await createApp(
        {
          issuer: "http://localhost",
          jwks: {
            path,
            controllerDecorator: (target) => {
              SetMetadata("isPublic", true)(target);
              isPublicMetadata = Reflect.getMetadata("isPublic", target);
            },
          },
        },
        "api",
        asyncOptions,
        [path],
        (createdApp) => {
          const jwt = createdApp.get(JwtService);
          expect(jwt.jwksPath).toBe(path);
          vi.spyOn(jwt, "getJwks").mockResolvedValue({ keys: [] });
          return Promise.resolve();
        },
      );
      expect(isPublicMetadata).toBe(true);
      const jwks = await fetch(`${url}${path}`);
      expect(jwks.status).toBe(200);
      expect(await jwks.json()).toEqual({ keys: [] });
      expect((await fetch(`${url}/api${path}`)).status).toBe(404);
      expect((await fetch(`${url}/.well-known/jwks.json`)).status).toBe(404);
    },
  );

  it("rejects Nest enhancers in jwks.controllerDecorator", async () => {
    await expect(
      createApp({
        issuer: "http://localhost",
        jwks: { controllerDecorator: UseGuards(DenyGuard) },
      }),
    ).rejects.toThrow(
      "JWKS controllerDecorator only supports metadata decorators",
    );
    expect(JwksController).toBeDefined();
  });

  it("disables key rotation by default and works inside PGlite transactions", async () => {
    const url = await createApp({ issuer: "http://auth.example" });
    const orm = app.get<PgliteORM>(MikroORM);
    await orm.schema.create();

    const signer = app.get(JwtService);
    const scope = { type: "download+jwt", audience: "files" };
    const claims = {
      ...scope,
      subject: "user:1",
      expiresIn: 60 * 60 * 24 * 90,
    };

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const start = Date.now();
      const initial = await fetch(`${url}/.well-known/jwks.json`);
      expect(initial.status).toBe(200);
      expect(await initial.json()).toEqual({ keys: [] });
      expect(await orm.em.fork().count(Jwk)).toBe(0);

      const [first, second] = await Promise.all([
        signer.sign({}, claims),
        signer.sign({}, { ...claims, subject: "user:2" }),
      ]);
      const header = decodeProtectedHeader(first);
      expect(header.alg).toBe("Ed25519");
      expect(decodeProtectedHeader(second).kid).toBe(header.kid);
      expect(await orm.em.fork().count(Jwk)).toBe(1);

      const [storedKey] = await orm.em.fork().find(Jwk, {});
      expect(storedKey.publicKey).toMatchObject({
        kty: "OKP",
        crv: "Ed25519",
        alg: "Ed25519",
      });
      expect(typeof storedKey.privateKey).toBe("string");
      expect(storedKey.expiresAt).toBeNull();

      await orm.em.transactional(async () => {
        const txToken = await signer.sign({}, claims);
        expect(decodeProtectedHeader(txToken).kid).toBe(header.kid);
        await expect(signer.verify(txToken, scope)).resolves.toMatchObject({
          sub: "user:1",
        });
        expect((await signer.getJwks()).keys).toHaveLength(1);
      });

      vi.setSystemTime(start + 60 * 24 * 60 * 60 * 1000);
      const laterToken = await signer.sign({}, claims);
      expect(decodeProtectedHeader(laterToken).kid).toBe(header.kid);
      expect(await orm.em.fork().count(Jwk)).toBe(1);
      await expect(signer.verify(first, scope)).resolves.toMatchObject({
        sub: "user:1",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rotates keys on demand, transitions null-expiry keys, and enforces token lifetime windows", async () => {
    vi.stubEnv("AUTH_URL", "http://auth.example");
    vi.stubEnv("APP_URL", "http://app.example");
    const unrotatedOptions: JwtModuleOptions = {
      secret,
      jwks: { alg: "ES256" },
    };
    const rotatedOptions: JwtModuleOptions = {
      secret,
      jwks: {
        alg: "ES256",
        rotationInterval: 10,
        gracePeriod: 20,
      },
    };
    const url = await createApp(rotatedOptions);
    const orm = app.get<PgliteORM>(MikroORM);
    await orm.schema.create();

    const unrotatedSigner = new JwtService(orm.em, unrotatedOptions);
    const firstSigner = app.get(JwtService);
    const nextAlgOptions: JwtModuleOptions = {
      ...rotatedOptions,
      jwks: { ...rotatedOptions.jwks, alg: "ES512" },
    };
    const secondSigner = new JwtService(orm.em, nextAlgOptions);
    const thirdSigner = new JwtService(orm.em, nextAlgOptions);
    const scope = { type: "test+jwt", audience: "test" };
    const claims = { ...scope, subject: "user:1", expiresIn: 20 };
    const otherType = { ...claims, type: "other+jwt" };

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const start = Date.now();
      // Mint a 60s token before rotation is enabled (expiresAt starts as null).
      const longUnrotatedToken = await unrotatedSigner.sign(
        {},
        { ...scope, subject: "user:1", expiresIn: 60 },
      );
      const oldHeader = decodeProtectedHeader(longUnrotatedToken);
      expect(oldHeader.alg).toBe("ES256");
      expect(oldHeader.kid).toBeDefined();
      expect(
        (await orm.em.fork().findOneOrFail(Jwk, { id: oldHeader.kid }))
          .expiresAt,
      ).toBeNull();

      // Enabling rotation stamps expiresAt on the existing null key and reuses it while fresh.
      const [reused, other] = await Promise.all([
        firstSigner.sign({}, claims),
        firstSigner.sign({}, otherType),
      ]);
      expect(decodeJwt(reused).iss).toBe("http://auth.example");
      expect(decodeProtectedHeader(reused).kid).toBe(oldHeader.kid);
      expect(decodeProtectedHeader(other).kid).toBe(oldHeader.kid);
      await expect(firstSigner.verify(other, scope)).rejects.toThrow(
        "Invalid token",
      );
      await expect(
        firstSigner.sign({}, { ...claims, expiresIn: 31 }),
      ).rejects.toThrow(
        "JWT expiry cannot exceed JWKS rotationInterval plus gracePeriod",
      );

      const activeJwks = await firstSigner.getJwks();
      expect(activeJwks).toEqual({
        keys: [
          expect.objectContaining({
            kid: oldHeader.kid,
            alg: "ES256",
            crv: "P-256",
            use: "sig",
          }),
        ],
      });
      const [firstKey] = await orm.em.fork().find(Jwk, {});
      expect(firstKey.createdAt.getTime()).toBe(start);
      expect(firstKey.expiresAt?.getTime()).toBe(start + 10_000);
      expect(await orm.em.fork().count(Jwk)).toBe(1);

      vi.stubEnv("AUTH_URL", undefined);
      const fallback = new JwtService(orm.em, rotatedOptions);
      const explicit = new JwtService(orm.em, {
        ...rotatedOptions,
        issuer: "https://explicit.example",
      });
      expect(decodeJwt(await fallback.sign({}, claims)).iss).toBe(
        "http://app.example",
      );
      expect(decodeJwt(await explicit.sign({}, claims)).iss).toBe(
        "https://explicit.example",
      );
      vi.stubEnv("APP_URL", undefined);
      expect(() => new JwtService(orm.em, rotatedOptions)).toThrow(
        "JWT issuer is required",
      );

      // At start + 6s, firstKey only has 24s of total verification life left (expiresAt 10s + grace 20s = 30s),
      // so requesting a 25s token rotates early to keep the issued token verifiable until its exp.
      vi.setSystemTime(start + 6_000);
      const earlyRotated = await secondSigner.sign(
        {},
        { ...scope, subject: "user:1", expiresIn: 25 },
      );
      const rotatedHeader = decodeProtectedHeader(earlyRotated);
      expect(rotatedHeader.alg).toBe("ES512");
      expect(rotatedHeader.kid).not.toBe(oldHeader.kid);
      expect(await orm.em.fork().count(Jwk)).toBe(2);

      // Concurrent peer signers reuse the fresh rotated key and JWKS reads never create keys.
      vi.setSystemTime(start + 10_000);
      const expiredJwks = await fetch(`${url}/.well-known/jwks.json`);
      const expiredJwksBody = (await expiredJwks.json()) as {
        keys: { kid: string; crv: string }[];
      };
      expect(expiredJwksBody.keys.map(({ kid }) => kid)).toEqual([
        rotatedHeader.kid,
        oldHeader.kid,
      ]);
      expect(expiredJwksBody.keys[0]?.crv).toBe("P-521");
      expect(await orm.em.fork().count(Jwk)).toBe(2);

      const concurrent = await thirdSigner.sign({}, claims);
      expect(decodeProtectedHeader(concurrent).kid).toBe(rotatedHeader.kid);
      await expect(
        firstSigner.verify(longUnrotatedToken, scope),
      ).resolves.toMatchObject({ sub: "user:1" });
      await expect(
        secondSigner.verify(earlyRotated, scope),
      ).resolves.toMatchObject({ sub: "user:1" });

      // At start + 30s, firstKey leaves gracePeriod so longUnrotatedToken (exp = 60s) is rejected,
      // while earlyRotated (exp = 31s, key verifiable until 36s) still verifies.
      vi.setSystemTime(start + 30_000);
      await expect(
        firstSigner.verify(longUnrotatedToken, scope),
      ).rejects.toThrow("Invalid token");
      await expect(
        secondSigner.verify(earlyRotated, scope),
      ).resolves.toMatchObject({ sub: "user:1" });
      expect((await firstSigner.getJwks()).keys.map(({ kid }) => kid)).toEqual([
        rotatedHeader.kid,
      ]);

      vi.setSystemTime(start + 36_000);
      const retiredJwks = await fetch(`${url}/.well-known/jwks.json`);
      expect(retiredJwks.status).toBe(200);
      expect(await retiredJwks.json()).toEqual({ keys: [] });
      expect(await orm.em.fork().count(Jwk)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("validates untrusted headers, runtime scopes, options, and active RLS transactions", async () => {
    await createApp({ issuer: "http://auth.example" });
    const orm = app.get<PgliteORM>(MikroORM);
    await orm.schema.create();
    const jwt = app.get(JwtService);
    const scope = { type: "test+jwt", audience: "test" };

    // Create a null-expiry key so operator injection on `kid` would match if unvalidated.
    const validToken = await jwt.sign(
      {},
      { ...scope, subject: "user:1", expiresIn: 60 },
    );
    const validKid = decodeProtectedHeader(validToken).kid;

    for (const badHeader of [
      { alg: "Ed25519" },
      { alg: "Ed25519", kid: { $ne: null } },
      { alg: "Ed25519", kid: ["id-1"] },
      { alg: "Ed25519", kid: { invalidOperator: 1 } },
      { alg: "Ed25519", kid: 123 },
      { alg: "Ed25519", kid: "bad\0kid" },
      { alg: "ES256", kid: "missing-kid" },
      { alg: "Ed25519", kid: "00000000-0000-4000-8000-000000000000" },
      { alg: "ES256", kid: validKid },
    ]) {
      await expect(
        jwt.verify(forgeTokenHeader(badHeader), scope),
      ).rejects.toThrow(UnauthorizedException);
    }

    await expect(
      jwt.verify("anything", { type: "", audience: "test" }),
    ).rejects.toThrow("JWT type is required");
    await expect(
      jwt.verify("anything", { type: "test+jwt", audience: "   " }),
    ).rejects.toThrow("JWT audience is required");
    await expect(
      jwt.sign({}, { ...scope, subject: "", expiresIn: 60 }),
    ).rejects.toThrow("JWT subject is required");
    await expect(
      jwt.sign({}, { ...scope, subject: "user:1", expiresIn: 0 }),
    ).rejects.toThrow("JWT expiry must be a positive number of seconds");

    expect(
      () =>
        new JwtService(orm.em, {
          issuer: "http://auth.example",
          secret: "short",
        }),
    ).toThrow("JWT requires a strong secret");
    expect(() => resolveJwksOptions({ path: "relative/path" })).toThrow(
      "JWKS path must be a literal absolute path",
    );
    expect(() => resolveJwksOptions({ alg: "RS256" as never })).toThrow(
      "JWKS alg must be Ed25519, ES256, or ES512",
    );
    expect(() => resolveJwksOptions({ rotationInterval: 0 })).toThrow(
      "JWKS rotationInterval must be a positive number of seconds",
    );
    expect(() => resolveJwksOptions({ gracePeriod: -1 })).toThrow(
      "JWKS gracePeriod must be a non-negative number of seconds",
    );

    const rlsFork = orm.em.fork({ useContext: true });
    rlsFork.setSessionContext({ variables: { "app.tenant_id": "t1" } });
    const rlsJwt = new JwtService(rlsFork, {
      issuer: "http://auth.example",
      secret,
    });
    await expect(
      rlsFork.transactional(async () => {
        await rlsJwt.getJwks();
      }),
    ).rejects.toThrow("JWT key access cannot bypass an active RLS transaction");
  });

  /**
   * Starts a Nest application using only the database and JWT modules.
   * @param overrides - JWT module options.
   * @param prefix - Host global prefix.
   * @param asyncOptions - Whether to configure JWT asynchronously.
   * @param exclude - Host prefix exclusions.
   * @param beforePrefix - Optional callback before setting the global prefix.
   * @returns URL of the listening server.
   */
  async function createApp(
    overrides: JwtModuleOptions = {},
    prefix?: string,
    asyncOptions = false,
    exclude: string[] = [],
    beforePrefix?: (app: INestApplication) => Promise<void>,
  ) {
    const options = { secret, ...overrides };
    const module = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [],
        }),
        asyncOptions
          ? JwtModule.forRootAsync({
              useFactory: () => Promise.resolve(options),
            })
          : JwtModule.forRoot(options),
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await beforePrefix?.(app);
    if (prefix) {
      app.setGlobalPrefix(prefix, { exclude });
    }
    await app.listen(0, "127.0.0.1");
    return await app.getUrl();
  }
});
