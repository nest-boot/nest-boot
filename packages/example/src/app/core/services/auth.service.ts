import { PersonalAccessToken } from "@nest-boot/auth";
import { BaseEntity, TransactionalConnection } from "@nest-boot/database";
import { Injectable } from "@nestjs/common";
import argon2 from "argon2";

import { User } from "../entities/user.entity";

@Injectable()
export class AuthService {
  constructor(private connection: TransactionalConnection) {}

  async attempt(email: string, password: string): Promise<User> {
    const user = await this.connection
      .getRepository(User)
      .findOne({ where: { email } });

    if (user && (await argon2.verify(user.password, password))) {
      return user;
    }

    return null;
  }

  async createToken(entity: BaseEntity): Promise<PersonalAccessToken> {
    const personalAccessTokenRepository =
      this.connection.getRepository(PersonalAccessToken);

    const personalAccessToken = personalAccessTokenRepository.create({
      entity: entity.constructor.name,
      entityId: entity.id,
    });

    return await personalAccessTokenRepository.save(personalAccessToken);
  }
}
