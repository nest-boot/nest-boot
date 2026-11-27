import { randomUUID } from "node:crypto";

import { EntityManager } from "@mikro-orm/core";
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
import { resolveJwksOptions } from "../utils/resolve-jwks-options.js";

interface TokenScope {
  type: string;
  audience: string;
}

export interface JwtSignOptions extends TokenScope {
  subject: string;
  expiresIn: number;
}

/** Signs application tokens and publishes their public verification keys. */
@Injectable()
export class JwtService {
  private readonly issuer: string;
  private readonly crypt: CryptService;
  private readonly jwks: ReturnType<typeof resolveJwksOptions>;

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
    if (!Number.isSafeInteger(options.expiresIn) || options.expiresIn < 1) {
      throw new Error("JWT expiry must be a positive number of seconds");
    }
    const key = await this.findOrCreateSigningKey();
    const { alg } = key.publicKey;
    const privateKey = await importPKCS8(
      await this.crypt.decrypt(key.privateKey),
      alg,
    );
    const now = Math.floor(Date.now() / 1000);

    return await new SignJWT(payload)
      .setProtectedHeader({ alg, kid: key.id, typ: options.type })
      .setIssuer(this.issuer)
      .setAudience(options.audience)
      .setSubject(options.subject)
      .setIssuedAt(now)
      .setExpirationTime(now + options.expiresIn)
      .sign(privateKey);
  }

  async verify(token: string, options: TokenScope): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(
        token,
        async ({ alg, kid }) => {
          if (!alg || !kid) {
            throw new UnauthorizedException("Invalid token");
          }
          const key = await this.keyManager().findOne(Jwk, {
            id: kid,
            expiresAt: { $gt: this.verificationCutoff() },
          });
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
    const keys = await this.keyManager().find(
      Jwk,
      { expiresAt: { $gt: this.verificationCutoff() } },
      { fields: ["id", "publicKey"] },
    );

    return {
      keys: keys.map(({ id, publicKey }) => ({
        ...publicKey,
        kid: id,
        use: "sig",
      })),
    };
  }

  private verificationCutoff(): Date {
    return new Date(Date.now() - this.jwks.gracePeriod * 1000);
  }

  private keyManager(): EntityManager {
    // Keep key persistence independent of the caller’s request transaction.
    return this.em.fork({ disableContextResolution: true });
  }

  private async findOrCreateSigningKey(): Promise<Jwk> {
    const findActiveKey = (em: EntityManager) =>
      em.findOne(
        Jwk,
        { expiresAt: { $gt: new Date() } },
        { orderBy: { createdAt: "desc" } },
      );

    const em = this.keyManager();
    const existing = await findActiveKey(em);
    if (existing) {
      return existing;
    }

    return await em.transactional(
      async (tx) => {
        // Serialize the read and creation across instances, including on an empty table.
        await tx
          .getConnection()
          .execute(
            "select pg_advisory_xact_lock(hashtext('nest-boot.auth.jwk'))",
            [],
            "get",
            tx.getTransactionContext(),
          );

        return (
          (await findActiveKey(tx)) ??
          tx.create(Jwk, await this.createKey(), { persist: true })
        );
      },
      { clear: true },
    );
  }

  private async createKey(): Promise<Jwk> {
    const { alg, ...keyOptions } = this.jwks.keyPairConfig;
    const { publicKey, privateKey } = await generateKeyPair(alg, {
      ...keyOptions,
      extractable: true,
    });
    const publicJwk = await exportJWK(publicKey);
    const encryptedPrivateKey = await this.crypt.encrypt(
      await exportPKCS8(privateKey),
    );
    const createdAt = new Date();

    return {
      id: randomUUID(),
      publicKey: { ...publicJwk, alg },
      privateKey: encryptedPrivateKey,
      createdAt,
      expiresAt: new Date(
        createdAt.getTime() + this.jwks.rotationInterval * 1000,
      ),
    };
  }
}
