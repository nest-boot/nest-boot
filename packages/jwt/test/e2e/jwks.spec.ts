import { MikroORM } from "@mikro-orm/core";
import { type MikroORM as PgliteORM, PgliteDriver } from "@mikro-orm/pglite";
import { IS_PUBLIC_KEY, Public } from "@nest-boot/common";
import { CryptService } from "@nest-boot/crypt";
import { DatabaseModule } from "@nest-boot/database";
import {
  type ArgumentsHost,
  type CallHandler,
  type CanActivate,
  Catch,
  Controller,
  type ExceptionFilter,
  type ExecutionContext,
  Get,
  type INestApplication,
  Injectable,
  Module,
  type NestInterceptor,
  type PipeTransform,
  SetMetadata,
  UnauthorizedException,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
  VersioningType,
} from "@nestjs/common";
import { APP_GUARD, HttpAdapterHost, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { type Observable } from "rxjs";

import { JwksController } from "../../src/controllers/jwks.controller.js";
import { Jwk } from "../../src/entities/jwk.entity.js";
import type { JwtModuleOptions } from "../../src/interfaces/jwt-module-options.interface.js";
import { JwtModule } from "../../src/jwt.module.js";
import { JwtService } from "../../src/services/jwt.service.js";
import { resolveJwksOptions } from "../../src/utils/resolve-jwks-options.util.js";

class CustomJwksException extends Error {}

@Injectable()
class InjectableJwksGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (req.headers["x-trigger-filter"] === "1") {
      throw new CustomJwksException(this.jwt.jwksPath);
    }
    return req.headers["x-deny-jwks"] !== "1";
  }
}

@Injectable()
class InjectableJwksInterceptor implements NestInterceptor {
  constructor(
    private readonly jwt: JwtService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    this.httpAdapterHost.httpAdapter.setHeader(
      context.switchToHttp().getResponse(),
      "x-jwks-path",
      this.jwt.jwksPath,
    );
    return next.handle();
  }
}

let instantiatedPipePath: string | undefined;

@Injectable()
class InjectableJwksPipe implements PipeTransform {
  constructor(jwt: JwtService) {
    instantiatedPipePath = jwt.jwksPath;
  }

  transform(value: unknown): unknown {
    return value;
  }
}

@Catch(CustomJwksException)
@Injectable()
class InjectableJwksFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: CustomJwksException, host: ArgumentsHost): void {
    this.httpAdapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { filteredPath: exception.message },
      418,
    );
  }
}

@Injectable()
class PublicAwareGlobalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) {
      throw new UnauthorizedException("Authentication is required");
    }
    return true;
  }
}

@Controller("protected")
class ProtectedController {
  @Get()
  getProtected(): { ok: boolean } {
    return { ok: true };
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
    vi.stubEnv("JWT_SECRET", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    vi.stubEnv("APP_SECRET", undefined);
    instantiatedPipePath = undefined;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it.each(["bare", "forRoot"] as const)(
    "supports zero-config registration using environment variables (%s)",
    async (mode) => {
      vi.stubEnv("APP_URL", "http://app.example");
      vi.stubEnv("AUTH_SECRET", secret);

      await expect(
        Test.createTestingModule({
          imports: [
            DatabaseModule.forRoot({
              driver: PgliteDriver,
              dbName: "memory://",
              entities: [],
            }),
            mode === "bare" ? JwtModule : JwtModule.forRoot(),
          ],
        }).compile(),
      ).rejects.toThrow(
        "JWT requires a strong secret of at least 32 characters. Set secret, JWT_SECRET, or APP_SECRET.",
      );

      vi.stubEnv("AUTH_SECRET", undefined);
      vi.stubEnv(mode === "bare" ? "JWT_SECRET" : "APP_SECRET", secret);

      const module = await Test.createTestingModule({
        imports: [
          DatabaseModule.forRoot({
            driver: PgliteDriver,
            dbName: "memory://",
            entities: [],
          }),
          mode === "bare" ? JwtModule : JwtModule.forRoot(),
        ],
        controllers: [ProtectedController],
        providers: [{ provide: APP_GUARD, useClass: PublicAwareGlobalGuard }],
      }).compile();

      app = module.createNestApplication();
      app.useLogger(false);
      app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: "1",
      });
      const jwt = app.get(JwtService);
      expect(jwt.jwksPath).toBe("/.well-known/jwks.json");
      app.setGlobalPrefix("api", { exclude: [jwt.jwksPath] });
      await app.listen(0, "127.0.0.1");
      const url = await app.getUrl();

      const orm = app.get<PgliteORM>(MikroORM);
      await orm.schema.create();

      expect((await fetch(`${url}/api/v1/protected`)).status).toBe(401);

      const scope = { type: "access+jwt", audience: "api" };
      const token = await jwt.sign(
        {},
        { ...scope, subject: "user:1", expiresIn: 60 },
      );
      await expect(jwt.verify(token, scope)).resolves.toMatchObject({
        iss: "http://app.example",
        sub: "user:1",
      });

      const jwksResponse = await fetch(`${url}/.well-known/jwks.json`);
      expect(jwksResponse.status).toBe(200);
      const jwksBody = (await jwksResponse.json()) as {
        keys: { kid: string }[];
      };
      expect(jwksBody.keys).toHaveLength(1);
      expect(jwksBody.keys[0]?.kid).toBe(decodeProtectedHeader(token).kid);
    },
  );

  it.each([false, true])(
    "marks the JWKS controller with @Public() and VERSION_NEUTRAL by default (async options: %s)",
    async (asyncOptions) => {
      const path = "/keys/public.json";
      let skipThrottleMetadata: unknown;
      const url = await createApp(
        {
          issuer: "http://localhost",
          jwks: {
            path,
            ...(asyncOptions
              ? {
                  decorators: [
                    Public(),
                    (target) => {
                      SetMetadata("skipThrottle", true)(target);
                      skipThrottleMetadata = Reflect.getMetadata(
                        "skipThrottle",
                        target,
                      );
                    },
                  ],
                }
              : {}),
          },
        },
        "api",
        asyncOptions,
        [path],
        (createdApp) => {
          createdApp.enableVersioning({
            type: VersioningType.URI,
            defaultVersion: "1",
          });
          const jwt = createdApp.get(JwtService);
          expect(jwt.jwksPath).toBe(path);
          vi.spyOn(jwt, "getJwks").mockResolvedValue({ keys: [] });
          return Promise.resolve();
        },
        true,
      );
      if (asyncOptions) {
        expect(skipThrottleMetadata).toBe(true);
      }
      const jwks = await fetch(`${url}${path}`);
      expect(jwks.status).toBe(200);
      expect(await jwks.json()).toEqual({ keys: [] });
      expect((await fetch(`${url}/api/v1/protected`)).status).toBe(401);
      expect((await fetch(`${url}/api${path}`)).status).toBe(404);
      expect((await fetch(`${url}/v1${path}`)).status).toBe(404);
      expect((await fetch(`${url}/.well-known/jwks.json`)).status).toBe(404);
    },
  );

  it.each([false, true])(
    "supports @UseGuards, @UseInterceptors, @UsePipes, and @UseFilters in jwks.decorators (async options: %s)",
    async (asyncOptions) => {
      const path = "/keys/enhanced.json";
      const url = await createApp(
        {
          issuer: "http://localhost",
          jwks: {
            path,
            decorators: [
              Public(),
              UseGuards(InjectableJwksGuard),
              UseInterceptors(InjectableJwksInterceptor),
              UsePipes(InjectableJwksPipe),
              UseFilters(InjectableJwksFilter),
            ],
          },
        },
        undefined,
        asyncOptions,
        [],
        (createdApp) => {
          vi.spyOn(createdApp.get(JwtService), "getJwks").mockResolvedValue({
            keys: [],
          });
          return Promise.resolve();
        },
        true,
      );

      expect(JwksController).toBeDefined();
      expect(instantiatedPipePath).toBe(path);

      const okResponse = await fetch(`${url}${path}`);
      expect(okResponse.status).toBe(200);
      expect(okResponse.headers.get("x-jwks-path")).toBe(path);
      expect(await okResponse.json()).toEqual({ keys: [] });

      const deniedResponse = await fetch(`${url}${path}`, {
        headers: { "x-deny-jwks": "1" },
      });
      expect(deniedResponse.status).toBe(403);

      const filteredResponse = await fetch(`${url}${path}`, {
        headers: { "x-trigger-filter": "1" },
      });
      expect(filteredResponse.status).toBe(418);
      expect(await filteredResponse.json()).toEqual({ filteredPath: path });
    },
  );

  it("uses 30-day Ed25519 rotation by default and handles PGlite transactions safely", async () => {
    const url = await createApp({ issuer: "http://auth.example" });
    const orm = app.get<PgliteORM>(MikroORM);
    await orm.schema.create();

    const signer = app.get(JwtService);
    const scope = { type: "download+jwt", audience: "files" };
    const claims = {
      ...scope,
      subject: "user:1",
      expiresIn: 60 * 60 * 24 * 30,
    };

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const start = Date.now();
      const initial = await fetch(`${url}/.well-known/jwks.json`);
      expect(initial.status).toBe(200);
      expect(await initial.json()).toEqual({ keys: [] });
      expect(await orm.em.fork().count(Jwk)).toBe(0);

      // Creating and reusing signing keys works seamlessly both inside and outside PGlite transactions.
      const txFirst = await orm.em.transactional(async () => {
        const token = await signer.sign({}, claims);
        await expect(signer.verify(token, scope)).resolves.toMatchObject({
          sub: "user:1",
        });
        expect((await signer.getJwks()).keys).toHaveLength(1);
        return token;
      });
      const header = decodeProtectedHeader(txFirst);
      expect(header.alg).toBe("Ed25519");
      expect(await orm.em.fork().count(Jwk)).toBe(1);

      vi.setSystemTime(start + 5_000);
      const second = await signer.sign({}, { ...claims, subject: "user:2" });
      expect(decodeProtectedHeader(second).kid).toBe(header.kid);
      expect(await orm.em.fork().count(Jwk)).toBe(1);

      const [storedKey] = await orm.em.fork().find(Jwk, {});
      expect(storedKey.publicKey).toMatchObject({
        kty: "OKP",
        crv: "Ed25519",
        alg: "Ed25519",
      });
      expect(typeof storedKey.privateKey).toBe("string");
      expect(storedKey.expiresAt.getTime()).toBe(
        start + 30 * 24 * 60 * 60 * 1000,
      );

      await orm.em.transactional(async () => {
        const txToken = await signer.sign({}, claims);
        expect(decodeProtectedHeader(txToken).kid).toBe(header.kid);
        await expect(signer.verify(txToken, scope)).resolves.toMatchObject({
          sub: "user:1",
        });
        expect((await signer.getJwks()).keys).toHaveLength(1);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("rotates keys on schedule, re-acquires stalled keys, and keeps tokens verifiable through exp", async () => {
    vi.stubEnv("AUTH_URL", "http://auth.example");
    vi.stubEnv("APP_URL", "http://app.example");
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

    const longGraceSigner = new JwtService(orm.em, {
      secret,
      jwks: {
        alg: "ES256",
        rotationInterval: 10,
        gracePeriod: 50,
      },
    });
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
      const initial = await fetch(`${url}/.well-known/jwks.json`);
      expect(initial.status).toBe(200);
      expect(await initial.json()).toEqual({ keys: [] });
      expect(await orm.em.fork().count(Jwk)).toBe(0);

      // Issue two concurrent 50s tokens on an empty table to exercise inflight key coalescing outside transactions.
      const [longToken, secondLongToken] = await Promise.all([
        longGraceSigner.sign(
          {},
          { ...scope, subject: "user:1", expiresIn: 50 },
        ),
        longGraceSigner.sign(
          {},
          { ...scope, subject: "user:2", expiresIn: 50 },
        ),
      ]);
      const oldHeader = decodeProtectedHeader(longToken);
      expect(oldHeader.alg).toBe("ES256");
      expect(decodeProtectedHeader(secondLongToken).kid).toBe(oldHeader.kid);

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
        firstSigner.sign({}, { ...claims, expiresIn: 21 }),
      ).rejects.toThrow("JWT expiry cannot exceed JWKS gracePeriod");

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
      expect(firstKey.expiresAt.getTime()).toBe(start + 10_000);
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

      // Simulate clock advancing past key expiry while decrypting the selected key so sign() re-acquires a fresh ES512 key.
      vi.setSystemTime(start + 9_000);
      const secondSignerCrypt = Reflect.get(
        secondSigner,
        "crypt",
      ) as CryptService;
      const originalDecrypt = secondSignerCrypt.decrypt.bind(secondSignerCrypt);
      let advancedDuringDecrypt = false;
      const decryptSpy = vi
        .spyOn(secondSignerCrypt, "decrypt")
        .mockImplementation(async (data: string) => {
          if (!advancedDuringDecrypt) {
            advancedDuringDecrypt = true;
            vi.setSystemTime(start + 11_000);
          }
          return await originalDecrypt(data);
        });
      let rotatedToken: string;
      try {
        rotatedToken = await secondSigner.sign({}, claims);
      } finally {
        decryptSpy.mockRestore();
      }
      const rotatedHeader = decodeProtectedHeader(rotatedToken);
      expect(rotatedHeader.alg).toBe("ES512");
      expect(rotatedHeader.kid).not.toBe(oldHeader.kid);
      expect(decodeJwt(rotatedToken).iat).toBe(
        Math.floor((start + 11_000) / 1000),
      );
      expect(decodeJwt(rotatedToken).exp).toBe(
        Math.floor((start + 11_000) / 1000) + 20,
      );
      expect(await orm.em.fork().count(Jwk)).toBe(2);

      // Concurrent peer signers reuse the fresh rotated key and JWKS reads never create keys.
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
      await expect(firstSigner.verify(longToken, scope)).resolves.toMatchObject(
        { sub: "user:1" },
      );
      await expect(
        secondSigner.verify(rotatedToken, scope),
      ).resolves.toMatchObject({ sub: "user:1" });

      // At start + 30s, firstKey leaves firstSigner's 20s gracePeriod so longToken (exp = 50s) is rejected,
      // while rotatedToken (created at +11s, verifiable until +41s, exp = +31s) still verifies.
      vi.setSystemTime(start + 30_000);
      await expect(firstSigner.verify(longToken, scope)).rejects.toThrow(
        "Invalid token",
      );
      await expect(
        secondSigner.verify(rotatedToken, scope),
      ).resolves.toMatchObject({ sub: "user:1" });
      expect((await firstSigner.getJwks()).keys.map(({ kid }) => kid)).toEqual([
        rotatedHeader.kid,
      ]);

      vi.setSystemTime(start + 41_000);
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
    expect(() => resolveJwksOptions({ decorators: ["bad" as never] })).toThrow(
      "JWKS decorators must be an array of class decorators",
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
    await rlsFork.transactional(async () => {
      expect((await rlsJwt.getJwks()).keys).toHaveLength(1);
    });
  });

  /**
   * Starts a Nest application using only the database and JWT modules.
   * @param overrides - JWT module options.
   * @param prefix - Host global prefix.
   * @param asyncOptions - Whether to configure JWT asynchronously.
   * @param exclude - Host prefix exclusions.
   * @param beforePrefix - Optional callback before setting the global prefix.
   * @param withGlobalGuard - Whether to register an `IS_PUBLIC_KEY`-aware global guard.
   * @returns URL of the listening server.
   */
  async function createApp(
    overrides: JwtModuleOptions = {},
    prefix?: string,
    asyncOptions = false,
    exclude: string[] = [],
    beforePrefix?: (app: INestApplication) => Promise<void>,
    withGlobalGuard = false,
  ) {
    const options = { secret, ...overrides };
    @Module({
      imports: [
        asyncOptions
          ? JwtModule.forRootAsync({
              useFactory: () => Promise.resolve(options),
            })
          : JwtModule.forRoot(options),
      ],
      exports: [JwtModule],
    })
    class ReexportedJwtModule {}

    const module = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          driver: PgliteDriver,
          dbName: "memory://",
          entities: [],
        }),
        ReexportedJwtModule,
      ],
      ...(withGlobalGuard
        ? {
            controllers: [ProtectedController],
            providers: [
              { provide: APP_GUARD, useClass: PublicAwareGlobalGuard },
            ],
          }
        : {}),
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
