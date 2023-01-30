import {
  AnyEntity,
  EntityManager,
  EntityRepository,
  Loaded,
} from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { AccessTokenInterface, AuthModuleOptions } from "./interfaces";
import ms = require("ms");
import { RequestContext } from "@nest-boot/request-context";

import { AUTH_ACCESS_TOKEN } from "./auth.constants";

@Injectable()
export class AuthService {
  private readonly accessTokenRepository: EntityRepository<AccessTokenInterface>;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly entityManager: EntityManager
  ) {
    this.accessTokenRepository = this.entityManager.getRepository(
      this.options.accessTokenEntityClass
    );
  }

  /**
   * 生成访问令牌
   * @param entity
   * @param name
   * @param expiresIn
   */
  async createToken(
    entity: AnyEntity,
    name: string,
    expiresIn?: string | number
  ): Promise<AccessTokenInterface> {
    const token = randomBytes(32).toString("hex");

    const _expiresIn = expiresIn ?? this.options.expiresIn;
    const _expiresInMs =
      typeof _expiresIn === "string" ? ms(_expiresIn) : _expiresIn;

    const accessToken = this.accessTokenRepository.create({
      name,
      token,
      entityId: entity.id,
      entityName: entity.constructor.name,
      expiresAt:
        _expiresInMs != null ? new Date(Date.now() + _expiresInMs) : undefined,
    });

    await this.accessTokenRepository.persistAndFlush(accessToken);

    return accessToken;
  }

  /**
   * 获取个人访问令牌
   * @param token 令牌，如果不传则从上下文中获取
   */
  async getToken(token?: string): Promise<Loaded<AccessTokenInterface> | null> {
    if (typeof token === "undefined") {
      return (
        RequestContext.get<AccessTokenInterface>(AUTH_ACCESS_TOKEN) ?? null
      );
    }

    return await this.accessTokenRepository.findOne({ token });
  }

  /**
   * 验证访问令牌
   * @param token 令牌，如果不传则从上下文中获取
   */
  async verifyToken(token?: string): Promise<boolean> {
    return (await this.getToken(token)) !== null;
  }

  /**
   * 撤销访问令牌
   * @param token 令牌，如果不传则从上下文中获取
   */
  async revokeToken(token?: string): Promise<void> {
    const accessToken = await this.getToken(token);

    if (accessToken !== null) {
      await this.accessTokenRepository.remove(accessToken).flush();
    }
  }
}