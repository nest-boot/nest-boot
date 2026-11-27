import {
  EntityManager,
  type ObjectQuery,
  type RequiredEntityData,
} from "@mikro-orm/core";
import { CryptService } from "@nest-boot/crypt";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
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
} from "../utils/resolve-jwks-options.js";

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
    @Inject(MODULE_OPTIONS_TOKEN) options: JwtModuleOptions,
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
      options.secret ??
      process.env.JWT_SECRET ??
      process.env.AUTH_SECRET ??
      process.env.APP_SECRET;
    if (
      !secret ||
      secret.length < 32 ||
      Math.log2(new Set(secret).size) * secret.length < 120
    ) {
      throw new Error(
        "JWT requires a strong secret of at least 32 characters. Set secret, JWT_SECRET, AUTH_SECRET, or APP_SECRET.",
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
    if (
      this.jwks.rotationInterval !== undefined &&
      options.expiresIn > this.jwks.rotationInterval + this.jwks.gracePeriod
    ) {
      throw new Error(
        "JWT expiry cannot exceed JWKS rotationInterval plus gracePeriod",
      );
    }

    const nowMs = Date.now();
    const key = await this.findOrCreateSigningKey(nowMs, options.expiresIn);
    const { alg } = key.publicKey;
    const privateKey = await importPKCS8(
      await this.crypt.decrypt(key.privateKey),
      alg,
    );
    const now = Math.floor(nowMs / 1000);

    return await new SignJWT(payload)
      .setProtectedHeader({ alg, kid: key.id, typ: options.type })
      .setIssuer(this.issuer)
      .setAudience(options.audience)
      .setSubject(options.subject)
      .setIssuedAt(now)
      .setExpirationTime(now + options.expiresIn)
      .sign(privateKey);
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
          const key = await this.keyManager().findOne(
            Jwk,
            {
              id: kid,
              ...this.verifiableKeyWhere(),
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
    const keys = await this.keyManager().find(Jwk, this.verifiableKeyWhere(), {
      fields: ["id", "publicKey"],
      orderBy: { createdAt: "desc" },
      connectionType: "write",
    });

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

  private verifiableKeyWhere(): ObjectQuery<Jwk> {
    return {
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: this.verificationCutoff() } },
      ],
    };
  }

  private verificationCutoff(): Date {
    return new Date(Date.now() - this.jwks.gracePeriod * 1000);
  }

  private signingExpiryCondition(
    nowMs: number,
    expiresIn: number,
  ): ObjectQuery<Jwk>["expiresAt"] {
    const minRemainingMs = Math.max(
      0,
      (expiresIn - this.jwks.gracePeriod) * 1000,
    );
    return minRemainingMs > 0
      ? { $gte: new Date(nowMs + minRemainingMs) }
      : { $gt: new Date(nowMs) };
  }

  private keyManager(): EntityManager {
    const current = this.em.getContext(false);
    if (!current.getSessionContext() && !current.global) {
      return current.fork({ clear: true, keepTransactionContext: true });
    }
    if (current.isInTransaction()) {
      throw new Error(
        "JWT key access cannot bypass an active RLS transaction. Call JwtService before starting the scoped transaction.",
      );
    }
    const fork = current.fork({ clear: true });
    fork.clearSessionContext();
    return fork;
  }

  private async findOrCreateSigningKey(
    nowMs: number,
    expiresIn: number,
  ): Promise<Jwk> {
    const em = this.keyManager();
    const expiryCondition = this.signingExpiryCondition(nowMs, expiresIn);
    const existing = await em.findOne(
      Jwk,
      {
        $or: [{ expiresAt: null }, { expiresAt: expiryCondition }],
      },
      { orderBy: { createdAt: "desc" }, connectionType: "write" },
    );

    if (
      existing?.expiresAt === null &&
      this.jwks.rotationInterval !== undefined
    ) {
      await this.assignRotationExpiryToNullKeys(
        em,
        nowMs,
        this.jwks.rotationInterval,
      );
      const refreshed = await em.findOne(
        Jwk,
        { expiresAt: expiryCondition },
        { orderBy: { createdAt: "desc" }, connectionType: "write" },
      );
      if (refreshed) {
        return refreshed;
      }
    } else if (existing) {
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

  private async assignRotationExpiryToNullKeys(
    em: EntityManager,
    nowMs: number,
    rotationInterval: number,
  ): Promise<void> {
    const nullKeys = await em.find(
      Jwk,
      { expiresAt: null },
      { connectionType: "write" },
    );
    for (const nullKey of nullKeys) {
      nullKey.expiresAt = new Date(
        Math.max(nowMs, nullKey.createdAt.getTime() + rotationInterval * 1000),
      );
    }
    await em.flush();
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
      expiresAt:
        this.jwks.rotationInterval === undefined
          ? null
          : new Date(createdAt.getTime() + this.jwks.rotationInterval * 1000),
    };
  }
}
