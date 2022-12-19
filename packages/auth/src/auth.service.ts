import {
  AnyEntity,
  EntityManager,
  EntityRepository,
  Loaded,
} from "@mikro-orm/core";
import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import {
  AuthModuleOptions,
  AuthPayload,
  PersonalAccessTokenInterface,
} from "./interfaces";
import ms = require("ms");
import { RequestContext } from "@nest-boot/request-context";

@Injectable()
export class AuthService {
  private readonly personalAccessTokenEntity: EntityRepository<PersonalAccessTokenInterface>;

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
    private readonly entityManager: EntityManager
  ) {
    this.personalAccessTokenEntity = this.entityManager.getRepository(
      this.options.personalAccessTokenEntity
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
  ): Promise<PersonalAccessTokenInterface> {
    const token = randomBytes(32).toString("hex");

    const _expiresIn = expiresIn ?? this.options.expiresIn;
    const _expiresInMs =
      typeof _expiresIn === "string" ? ms(_expiresIn) : _expiresIn;

    const personalAccessToken = this.personalAccessTokenEntity.create({
      name,
      token,
      entityId: entity.id,
      entityName: entity.constructor.name,
      expiresAt:
        _expiresInMs != null ? new Date(Date.now() + _expiresInMs) : undefined,
    });

    await this.personalAccessTokenEntity.persistAndFlush(personalAccessToken);

    return personalAccessToken;
  }

  /**
   * 获取个人访问令牌
   * @param token 令牌，如果不传则从上下文中获取
   */
  async getToken(
    token?: string
  ): Promise<Loaded<PersonalAccessTokenInterface> | null> {
    if (typeof token === "undefined") {
      return (
        RequestContext.get<AuthPayload>("auth")?.personalAccessToken ?? null
      );
    }

    return await this.personalAccessTokenEntity.findOne({ token });
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
    const personalAccessToken = await this.getToken(token);

    if (personalAccessToken !== null) {
      await this.personalAccessTokenEntity.remove(personalAccessToken).flush();
    }
  }
}
