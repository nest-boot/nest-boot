import { EntityClass, EntityManager } from "@mikro-orm/core";
import { HashService } from "@nest-boot/hash";
import { Inject, Injectable } from "@nestjs/common";

import { MODULE_OPTIONS_TOKEN } from "./auth.module-definition";
import { PersonalAccessToken, User } from "./entities";
import { AuthModuleOptions } from "./interfaces";
import { randomString } from "./utils/random-string.util";

/**
 * Service responsible for handling authentication-related operations.
 */
@Injectable()
export class AuthService {
  private readonly User: EntityClass<User>;
  private readonly PersonalAccessToken: EntityClass<PersonalAccessToken>;

  private readonly expiresIn?: number;

  /**
   * Constructs a new instance of the AuthService class.
   * @param em The EntityManager instance.
   * @param hashService The HashService instance.
   * @param options The options for the Auth module.
   */
  constructor(
    private readonly em: EntityManager,
    private readonly hashService: HashService,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions,
  ) {
    this.User = this.options?.entities?.User ?? User;
    this.PersonalAccessToken =
      this.options?.entities?.PersonalAccessToken ?? PersonalAccessToken;

    this.expiresIn = this.options?.expiresIn;
  }

  /**
   * Attempts to authenticate a user with the provided email and password.
   * @param email The user's email.
   * @param password The user's password.
   * @returns The authenticated user if successful, otherwise null.
   */
  async attempt(email: string, password: string) {
    const user = await this.em.findOne(
      this.User,
      { email },
      { filters: false },
    );

    if (
      // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
      user === null ||
      user.password === null ||
      !(await this.hashService.verify(user.password, password))
    ) {
      return null;
    }

    return user;
  }

  /**
   * Retrieves a personal access token by its token value.
   * @param token The token value.
   * @returns The personal access token if found, otherwise null.
   */
  async getToken(token: string): Promise<PersonalAccessToken | null> {
    return await this.em.findOne(
      this.PersonalAccessToken,
      {
        token,
      },
      { filters: false },
    );
  }

  /**
   * Creates a new personal access token for a user.
   * @param user The user for whom the token is created.
   * @param name The name of the token.
   * @param permissions The permissions associated with the token.
   * @param expiresIn The expiration time for the token.
   * @returns An object containing the token and the personal access token entity.
   */
  async createToken(
    user: User,
    name: string,
    permissions: string[] = ["*"],
    expiresIn?: number,
  ): Promise<{ token: string; personalAccessToken: PersonalAccessToken }> {
    const token = randomString(48);

    expiresIn = expiresIn ?? this.expiresIn;

    const personalAccessToken = this.em.create(this.PersonalAccessToken, {
      user,
      name,
      token,
      permissions,
      expiresAt:
        typeof expiresIn !== "undefined"
          ? new Date(Date.now() + expiresIn)
          : null,
    });

    await this.em.persistAndFlush(personalAccessToken);

    return { token, personalAccessToken };
  }

  /**
   * Deletes a personal access token.
   * @param personalAccessToken - The personal access token to be deleted.
   * @returns A Promise that resolves when the token is successfully deleted.
   */
  async deleteToken(personalAccessToken: PersonalAccessToken): Promise<void> {
    await this.em.remove(personalAccessToken).flush();
  }

  /**
   * Registers a new user.
   * @param name The user's name.
   * @param email The user's email.
   * @param password The user's password.
   * @param permissions The permissions associated with the user.
   * @returns The registered user.
   */
  async register(
    name: string,
    email: string,
    password: string,
    permissions: string[] = [],
  ) {
    const hashedPassword = await this.hashService.create(password);

    const user = this.em.create(this.User, {
      name,
      email,
      password: hashedPassword,
      permissions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.em.persistAndFlush(user);

    return user;
  }

  async updateLastUsedAt(
    personalAccessToken: PersonalAccessToken,
    flush = true,
  ) {
    personalAccessToken.lastUsedAt = new Date();

    if (flush) {
      await this.em.flush();
    }
  }
}
