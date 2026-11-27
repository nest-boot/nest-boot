import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { DatabaseModule } from "@nest-boot/database";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { decodeJwt, decodeProtectedHeader } from "jose";

import { Jwk } from "../../src/entities/jwk.entity.js";
import type { JwtModuleOptions } from "../../src/interfaces/jwt-module-options.interface.js";
import { JwtModule } from "../../src/jwt.module.js";
import { JwtService } from "../../src/services/jwt.service.js";

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
    "uses the configured JWKS controller path (async options: %s)",
    async (asyncOptions) => {
      const path = "/keys/public.json";
      const url = await createApp(
        { issuer: "http://localhost", jwks: { path } },
        "api",
        asyncOptions,
        [path],
        (app) => {
          const jwt = app.get(JwtService);
          expect(jwt.jwksPath).toBe(path);
          vi.spyOn(jwt, "getJwks").mockResolvedValue({ keys: [] });
          return Promise.resolve();
        },
      );
      const jwks = await fetch(`${url}${path}`);
      expect(jwks.status).toBe(200);
      expect(await jwks.json()).toEqual({ keys: [] });
      expect((await fetch(`${url}/api${path}`)).status).toBe(404);
      expect((await fetch(`${url}/.well-known/jwks.json`)).status).toBe(404);
    },
  );

  it("only creates and rotates keys during signing", async () => {
    vi.stubEnv("AUTH_URL", "http://auth.example");
    vi.stubEnv("APP_URL", "http://app.example");
    const options = {
      secret,
      jwks: {
        keyPairConfig: { alg: "ES256" },
        rotationInterval: 10,
        gracePeriod: 20,
      },
    } satisfies JwtModuleOptions;
    const url = await createApp(options);
    const orm = app.get<PgliteORM>(MikroORM);
    await orm.schema.create();

    const firstSigner = app.get(JwtService);
    const initialPeer = new JwtService(orm.em, options);
    const rotatedOptions: JwtModuleOptions = {
      ...options,
      jwks: { ...options.jwks, keyPairConfig: { alg: "EdDSA" } },
    };
    const secondSigner = new JwtService(orm.em, rotatedOptions);
    const thirdSigner = new JwtService(orm.em, rotatedOptions);
    const scope = { type: "test+jwt", audience: "test" };
    const claims = { ...scope, subject: "user:1", expiresIn: 60 };
    const otherType = { ...claims, type: "other+jwt" };

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const start = Date.now();
      const initial = await fetch(`${url}/.well-known/jwks.json`);
      expect(initial.status).toBe(200);
      expect(await initial.json()).toEqual({ keys: [] });
      expect(await orm.em.fork().count(Jwk)).toBe(0);

      const [old, other] = await Promise.all([
        firstSigner.sign({}, claims),
        initialPeer.sign({}, otherType),
      ]);
      expect(decodeJwt(old).iss).toBe("http://auth.example");
      const oldHeader = decodeProtectedHeader(old);
      expect(oldHeader.alg).toBe("ES256");
      expect(decodeProtectedHeader(other).kid).toBe(oldHeader.kid);
      await expect(firstSigner.verify(other, scope)).rejects.toThrow(
        "Invalid token",
      );
      const activeJwks = await firstSigner.getJwks();
      expect(activeJwks).toEqual({
        keys: [expect.objectContaining({ kid: oldHeader.kid, alg: "ES256" })],
      });
      const [firstKey] = await orm.em.fork().find(Jwk, {});
      expect(firstKey.createdAt.getTime()).toBe(start);
      expect(firstKey.expiresAt?.getTime()).toBe(start + 10_000);
      expect(await orm.em.fork().count(Jwk)).toBe(1);

      vi.stubEnv("AUTH_URL", undefined);
      const fallback = new JwtService(orm.em, options);
      const explicit = new JwtService(orm.em, {
        ...options,
        issuer: "https://explicit.example",
      });
      expect(decodeJwt(await fallback.sign({}, claims)).iss).toBe(
        "http://app.example",
      );
      expect(decodeJwt(await explicit.sign({}, claims)).iss).toBe(
        "https://explicit.example",
      );
      vi.stubEnv("APP_URL", undefined);
      expect(() => new JwtService(orm.em, options)).toThrow(
        "JWT issuer is required",
      );

      vi.setSystemTime(start + 10_000);
      const expiredJwks = await fetch(`${url}/.well-known/jwks.json`);
      expect(await expiredJwks.json()).toEqual(activeJwks);
      expect(await orm.em.fork().count(Jwk)).toBe(1);

      const [current, concurrent] = await Promise.all([
        secondSigner.sign({}, claims),
        thirdSigner.sign({}, claims),
      ]);
      const currentHeader = decodeProtectedHeader(current);
      expect(currentHeader.alg).toBe("EdDSA");
      expect(currentHeader.kid).not.toBe(oldHeader.kid);
      expect(decodeProtectedHeader(concurrent).kid).toBe(currentHeader.kid);
      expect(await orm.em.fork().count(Jwk)).toBe(2);

      const publishedIds = (await firstSigner.getJwks()).keys.map(
        ({ kid }) => kid,
      );
      expect(publishedIds).toEqual(
        expect.arrayContaining([currentHeader.kid, oldHeader.kid]),
      );
      await expect(firstSigner.verify(old, scope)).resolves.toMatchObject({
        sub: "user:1",
      });
      await expect(secondSigner.verify(current, scope)).resolves.toMatchObject({
        sub: "user:1",
      });

      vi.setSystemTime(start + 30_000);
      await expect(firstSigner.verify(old, scope)).rejects.toThrow(
        "Invalid token",
      );
      expect((await firstSigner.getJwks()).keys.map(({ kid }) => kid)).toEqual([
        currentHeader.kid,
      ]);

      vi.setSystemTime(start + 40_000);
      const retiredJwks = await fetch(`${url}/.well-known/jwks.json`);
      expect(retiredJwks.status).toBe(200);
      expect(await retiredJwks.json()).toEqual({ keys: [] });
      expect(await orm.em.fork().count(Jwk)).toBe(2);
    } finally {
      vi.useRealTimers();
    }
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
