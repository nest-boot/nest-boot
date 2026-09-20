import { Args, ID, Mutation, Query, Resolver } from "@nest-boot/graphql";

import { Public } from "../decorators/public.decorator.js";
import { User } from "../entities/user.entity.js";
import { AuthChangeEmailInput } from "../inputs/auth-change-email.input.js";
import { AuthChangePasswordInput } from "../inputs/auth-change-password.input.js";
import { AuthDeleteUserInput } from "../inputs/auth-delete-user.input.js";
import { AuthLinkSocialAccountInput } from "../inputs/auth-link-social-account.input.js";
import { AuthRequestPasswordResetInput } from "../inputs/auth-request-password-reset.input.js";
import { AuthResetPasswordInput } from "../inputs/auth-reset-password.input.js";
import { AuthSendVerificationEmailInput } from "../inputs/auth-send-verification-email.input.js";
import { AuthSignInInput } from "../inputs/auth-sign-in.input.js";
import { AuthSignInSocialInput } from "../inputs/auth-sign-in-social.input.js";
import { AuthSignUpInput } from "../inputs/auth-sign-up.input.js";
import { AuthUpdateUserInput } from "../inputs/auth-update-user.input.js";
import { AuthAbilityRuleType } from "../objects/auth-ability-rule.object.js";
import { AuthChangePasswordResultType } from "../objects/auth-change-password-result.object.js";
import { AuthDeleteUserResultType } from "../objects/auth-delete-user-result.object.js";
import { AuthLinkSocialAccountResultType } from "../objects/auth-link-social-account-result.object.js";
import { AuthRequestPasswordResetResultType } from "../objects/auth-request-password-reset-result.object.js";
import { AuthSignInResultType } from "../objects/auth-sign-in-result.object.js";
import { AuthSignInSocialResultType } from "../objects/auth-sign-in-social-result.object.js";
import { AuthSocialProviderType } from "../objects/auth-social-provider.object.js";
import { SignUpPayload } from "../objects/sign-up-payload.object.js";
import { AuthService } from "../services/auth.service.js";
import { getAbility } from "../utils/get-ability.util.js";
import { serializeAbilityRules } from "../utils/serialize-ability-rules.util.js";

/** GraphQL transport for application authentication operations. */
@Resolver(() => User)
export class AuthResolver {
  /**
   * Creates the authentication resolver.
   * @param authService - Application authentication service.
   */
  constructor(private readonly authService: AuthService) {}

  /** Returns the currently authenticated user. */
  @Query(() => User)
  currentUser(): User {
    return this.authService.getCurrentUser();
  }

  /** Returns the social and generic OAuth providers enabled by the server. */
  @Public()
  @Query(() => [AuthSocialProviderType])
  async socialProviders(): Promise<AuthSocialProviderType[]> {
    return await this.authService.listSocialProviders();
  }

  /** Returns the unified effective CASL rules for the current request identity. */
  @Query(() => [AuthAbilityRuleType])
  currentAbilityRules(): AuthAbilityRuleType[] {
    return toAbilityRuleTypes(serializeAbilityRules(getAbility()));
  }

  /** Registers a user with an email address and password. */
  @Public()
  @Mutation(() => SignUpPayload)
  async signUp(@Args("input") input: AuthSignUpInput): Promise<SignUpPayload> {
    return await this.authService.signUpPayload({ ...input });
  }

  /** Signs in with an email address and password. */
  @Public()
  @Mutation(() => AuthSignInResultType)
  async signIn(
    @Args("input") input: AuthSignInInput,
  ): Promise<AuthSignInResultType> {
    return await this.authService.signInEntity(input);
  }

  /** Starts a social or generic OAuth sign-in flow. */
  @Public()
  @Mutation(() => AuthSignInSocialResultType)
  async signInSocial(
    @Args("input") input: AuthSignInSocialInput,
  ): Promise<AuthSignInSocialResultType> {
    return await this.authService.signInSocialEntity({
      ...input,
      disableRedirect: true,
    });
  }

  /** Signs out and forwards the session-cookie removal header. */
  @Public()
  @Mutation(() => Boolean)
  async signOut(): Promise<boolean> {
    return await this.authService.signOut();
  }

  /** Sends an email-verification message. */
  @Public()
  @Mutation(() => Boolean)
  async sendVerificationEmail(
    @Args("input") input: AuthSendVerificationEmailInput,
  ): Promise<boolean> {
    return await this.authService.sendVerificationEmail(input);
  }

  /** Requests an enumeration-safe password-reset message. */
  @Public()
  @Mutation(() => AuthRequestPasswordResetResultType)
  async requestPasswordReset(
    @Args("input") input: AuthRequestPasswordResetInput,
  ): Promise<AuthRequestPasswordResetResultType> {
    return await this.authService.requestPasswordReset(input);
  }

  /** Resets a password with a password-reset token. */
  @Public()
  @Mutation(() => Boolean)
  async resetPassword(
    @Args("input") input: AuthResetPasswordInput,
  ): Promise<boolean> {
    return await this.authService.resetPassword(input);
  }

  /** Updates the authenticated user's profile. */
  @Mutation(() => Boolean)
  async updateCurrentUser(
    @Args("input") input: AuthUpdateUserInput,
  ): Promise<boolean> {
    return await this.authService.updateCurrentUser({ ...input });
  }

  /** Starts or completes an authenticated email change. */
  @Mutation(() => Boolean)
  async changeCurrentUserEmail(
    @Args("input") input: AuthChangeEmailInput,
  ): Promise<boolean> {
    return await this.authService.changeCurrentUserEmail(input);
  }

  /** Changes the authenticated user's password. */
  @Mutation(() => AuthChangePasswordResultType)
  async changeCurrentUserPassword(
    @Args("input") input: AuthChangePasswordInput,
  ): Promise<AuthChangePasswordResultType> {
    return await this.authService.changeCurrentUserPassword(input);
  }

  /** Adds a credential password to the authenticated account. */
  @Mutation(() => Boolean)
  async setCurrentUserPassword(
    @Args("newPassword") newPassword: string,
  ): Promise<boolean> {
    return await this.authService.setCurrentUserPassword(newPassword);
  }

  /** Requests deletion of the authenticated user. */
  @Mutation(() => AuthDeleteUserResultType)
  async deleteCurrentUser(
    @Args("input", { nullable: true, defaultValue: {} })
    input?: AuthDeleteUserInput,
  ): Promise<AuthDeleteUserResultType> {
    return await this.authService.deleteCurrentUser(input ?? {});
  }

  /** Starts a social or OpenID Connect account-linking flow. */
  @Mutation(() => AuthLinkSocialAccountResultType)
  async linkCurrentUserAccount(
    @Args("input") input: AuthLinkSocialAccountInput,
  ): Promise<AuthLinkSocialAccountResultType> {
    return await this.authService.linkCurrentUserAccount({
      ...input,
      disableRedirect: true,
    });
  }

  /** Unlinks an authentication account from the current user. */
  @Mutation(() => Boolean)
  async unlinkCurrentUserAccount(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    return await this.authService.unlinkCurrentUserAccount({
      accountId: id,
    });
  }
}

function toAbilityRuleTypes(
  rules: ReturnType<typeof serializeAbilityRules>,
): AuthAbilityRuleType[] {
  return rules.map((rule) => ({
    actions: Array.isArray(rule.action) ? rule.action : [rule.action],
    subjects: Array.isArray(rule.subject) ? rule.subject : [rule.subject],
    fields:
      rule.fields === undefined
        ? null
        : Array.isArray(rule.fields)
          ? rule.fields
          : [rule.fields],
    conditions: rule.conditions ?? null,
    inverted: rule.inverted ?? false,
    reason: rule.reason ?? null,
  }));
}
