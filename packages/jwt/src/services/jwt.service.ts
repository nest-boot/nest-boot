import { EntityManager, type RequiredEntityData } from "@mikro-orm/core";
import { CryptService } from "@nest-boot/crypt";
import {
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import {
  type CryptoKey,
  errors,
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  importJWK,
  importPKCS8,
  type JSONWebKeySet,
  type JWTPayload,
  jwtVerify,
  SignJWT,
} from "jose";

import { Jwk } from "../entities/jwk.entity.js";
import type { JwtModuleOptions } from "../interfaces/jwt-module-options.interface.js";
import { MODULE_OPTIONS_TOKEN } from "../jwt.module-definition.js";
import {
  type ResolvedJwksOptions,
  resolveJwksOptions,
} from "../utils/resolve-jwks-options.util.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface JwtVerifyOptions {
  type: string;
  audience: string;
}

export interface JwtSignOptions extends JwtVerifyOptions {
  subject: string;
  expiresIn: number;
}

/** Signs application tokens and publishes their public verification keys. */
@Injectable()
export class JwtService {
  private readonly issuer: string;
  private readonly crypt: CryptService;
  private readonly jwks: ResolvedJwksOptions;
  private inflightKeyCreation?: Promise<Jwk>;

  constructor(
    private readonly em: EntityManager,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    options: JwtModuleOptions = {},
  ) {
    this.jwks = resolveJwksOptions(options.jwks);
    const issuer =
      options.issuer ?? process.env.AUTH_URL ?? process.env.APP_URL;
    if (!issuer?.trim()) {
      throw new Error(
        "JWT issuer is required. Set issuer, AUTH_URL, or APP_URL.",
      );
    }

    const secret =
      options.secret ?? process.env.JWT_SECRET ?? process.env.APP_SECRET;
    if (
      !secret ||
      secret.length < 32 ||
      Math.log2(new Set(secret).size) * secret.length < 120
    ) {
      throw new Error(
        "JWT requires a strong secret of at least 32 characters. Set secret, JWT_SECRET, or APP_SECRET.",
      );
    }

    this.issuer = issuer;
    this.crypt = new CryptService(`auth-jwt:${secret}`);
  }

  get jwksPath(): string {
    return this.jwks.path;
  }

  async sign(payload: JWTPayload, options: JwtSignOptions): Promise<string> {
    this.assertVerifyOptions(options);
    if (typeof options.subject !== "string" || !options.subject.trim()) {
      throw new Error("JWT subject is required");
    }
    if (!Number.isSafeInteger(options.expiresIn) || options.expiresIn < 1) {
      throw new Error("JWT expiry must be a positive number of seconds");
    }
    if (options.expiresIn > this.jwks.gracePeriod) {
      throw new Error("JWT expiry cannot exceed JWKS gracePeriod");
    }

    let prepared = await this.prepareSigningKey();
    let now = Math.floor(Date.now() / 1000);
    let exp = now + options.expiresIn;
    if (
      prepared.key.expiresAt.getTime() + this.jwks.gracePeriod * 1000 <
      exp * 1000
    ) {
      prepared = await this.prepareSigningKey();
      now = Math.floor(Date.now() / 1000);
      exp = now + options.expiresIn;
    }

    return await new SignJWT(payload)
      .setProtectedHeader({
        alg: prepared.key.publicKey.alg,
        kid: prepared.key.id,
        typ: options.type,
      })
      .setIssuer(this.issuer)
      .setAudience(options.audience)
      .setSubject(options.subject)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(prepared.privateKey);
  }

  async verify(token: string, options: JwtVerifyOptions): Promise<JWTPayload> {
    this.assertVerifyOptions(options);
    try {
      const { payload } = await jwtVerify(
        token,
        async ({ alg, kid }) => {
          if (
            typeof alg !== "string" ||
            !alg ||
            typeof kid !== "string" ||
            !uuidPattern.test(kid)
          ) {
            throw new UnauthorizedException("Invalid token");
          }
          const key = await this.createEntityManager().findOne(
            Jwk,
            {
              id: kid,
              expiresAt: { $gt: this.verificationCutoff() },
            },
            { connectionType: "write" },
          );
          if (key?.publicKey.alg !== alg) {
            throw new UnauthorizedException("Invalid token");
          }
          return await importJWK(key.publicKey, key.publicKey.alg);
        },
        {
          issuer: this.issuer,
          audience: options.audience,
          typ: options.type,
          requiredClaims: ["exp", "sub"],
        },
      );
      return payload;
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        throw new UnauthorizedException("Invalid token");
      }
      throw error;
    }
  }

  async getJwks(): Promise<JSONWebKeySet> {
    const keys = await this.createEntityManager().find(
      Jwk,
      { expiresAt: { $gt: this.verificationCutoff() } },
      {
        fields: ["id", "publicKey"],
        orderBy: { createdAt: "desc" },
        connectionType: "write",
      },
    );

    return {
      keys: keys.map(({ id, publicKey }) => ({
        ...publicKey,
        kid: id,
        use: "sig",
      })),
    };
  }

  private assertVerifyOptions(options: JwtVerifyOptions): void {
    if (typeof options?.type !== "string" || !options.type.trim()) {
      throw new Error("JWT type is required");
    }
    if (typeof options.audience !== "string" || !options.audience.trim()) {
      throw new Error("JWT audience is required");
    }
  }

  private verificationCutoff(): Date {
    return new Date(Date.now() - this.jwks.gracePeriod * 1000);
  }

  private createEntityManager(): EntityManager {
    return this.em.fork({ keepTransactionContext: true });
  }

  private async prepareSigningKey(): Promise<{
    key: Jwk;
    privateKey: CryptoKey;
  }> {
    const key = await this.findOrCreateSigningKey();
    const privateKey = await importPKCS8(
      await this.crypt.decrypt(key.privateKey),
      key.publicKey.alg,
    );
    return { key, privateKey };
  }

  private async findOrCreateSigningKey(): Promise<Jwk> {
    const em = this.createEntityManager();
    const existing = await em.findOne(
      Jwk,
      { expiresAt: { $gt: new Date() } },
      { orderBy: { createdAt: "desc" }, connectionType: "write" },
    );
    if (existing) {
      return existing;
    }

    if (em.isInTransaction()) {
      return await this.createAndPersistKey(em);
    }

    return await (this.inflightKeyCreation ??= this.createAndPersistKey(
      em,
    ).finally(() => {
      this.inflightKeyCreation = undefined;
    }));
  }

  private async createAndPersistKey(em: EntityManager): Promise<Jwk> {
    const key = em.create(Jwk, await this.createKey(), { persist: true });
    await em.flush();
    return key;
  }

  private async createKey(): Promise<RequiredEntityData<Jwk>> {
    const { alg } = this.jwks;
    const { publicKey, privateKey } = await generateKeyPair(alg, {
      extractable: true,
    });
    const publicJwk = await exportJWK(publicKey);
    const encryptedPrivateKey = await this.crypt.encrypt(
      await exportPKCS8(privateKey),
    );
    const createdAt = new Date();

    return {
      publicKey: { ...publicJwk, alg },
      privateKey: encryptedPrivateKey,
      createdAt,
      expiresAt: new Date(
        createdAt.getTime() + this.jwks.rotationInterval * 1000,
      ),
    };
  }
}
