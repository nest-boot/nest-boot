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
import { PasswordPolicy } from "../objects/password-policy.object.js";
import { SignUpPayload } from "../objects/sign-up-payload.object.js";
import { AuthService } from "../services/auth.service.js";
import { getAuthAbility } from "../utils/get-auth-ability.util.js";
import { serializeAbilityRules } from "../utils/serialize-ability-rules.util.js";

/** GraphQL transport for application authentication operations. */
@Resolver(() => User)
export class AuthResolver {
  /**
   * Creates the authentication resolver.
   * @param authService - Application authentication service.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Returns password limits without requiring a session.
   * @returns Configured password length limits.
   */
  @Public()
  @Query(() => PasswordPolicy)
  passwordPolicy(): PasswordPolicy {
    return this.authService.getPasswordPolicy();
  }

  /**
   * Returns the currently authenticated user.
   * @returns Authenticated user from the current request.
   */
  @Query(() => User)
  currentUser(): User {
    return this.authService.getCurrentUser();
  }

  /**
   * Returns the social and generic OAuth providers enabled by the server.
   * @returns Available social authentication providers.
   */
  @Public()
  @Query(() => [AuthSocialProviderType])
  async socialProviders(): Promise<AuthSocialProviderType[]> {
    return await this.authService.listSocialProviders();
  }

  /**
   * Returns the unified effective CASL rules for the current request identity.
   * @returns Serializable authorization rules for the current request.
   */
  @Query(() => [AuthAbilityRuleType])
  currentAbilityRules(): AuthAbilityRuleType[] {
    return toAbilityRuleTypes(serializeAbilityRules(getAuthAbility()));
  }

  /**
   * Registers a user with an email address and password.
   * @param input - Requested field values for the operation.
   * @returns Created user identifier and optional session token.
   */
  @Public()
  @Mutation(() => SignUpPayload)
  async signUp(@Args("input") input: AuthSignUpInput): Promise<SignUpPayload> {
    return await this.authService.signUpPayload({ ...input });
  }

  /**
   * Signs in with an email address and password.
   * @param input - Requested field values for the operation.
   * @returns Sign-in response with the authenticated user.
   */
  @Public()
  @Mutation(() => AuthSignInResultType)
  async signIn(
    @Args("input") input: AuthSignInInput,
  ): Promise<AuthSignInResultType> {
    return await this.authService.signInEntity(input);
  }

  /**
   * Starts a social or generic OAuth sign-in flow.
   * @param input - Requested field values for the operation.
   * @returns Social sign-in result and any redirect information.
   */
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

  /**
   * Signs out and forwards the session-cookie removal header.
   * @returns Whether the current session was signed out successfully.
   */
  @Public()
  @Mutation(() => Boolean)
  async signOut(): Promise<boolean> {
    return await this.authService.signOut();
  }

  /**
   * Sends an email-verification message.
   * @param input - Requested field values for the operation.
   * @returns Whether the verification email request succeeded.
   */
  @Public()
  @Mutation(() => Boolean)
  async sendVerificationEmail(
    @Args("input") input: AuthSendVerificationEmailInput,
  ): Promise<boolean> {
    return await this.authService.sendVerificationEmail(input);
  }

  /**
   * Requests an enumeration-safe password-reset message.
   * @param input - Requested field values for the operation.
   * @returns Password reset request status and message.
   */
  @Public()
  @Mutation(() => AuthRequestPasswordResetResultType)
  async requestPasswordReset(
    @Args("input") input: AuthRequestPasswordResetInput,
  ): Promise<AuthRequestPasswordResetResultType> {
    return await this.authService.requestPasswordReset(input);
  }

  /**
   * Resets a password with a password-reset token.
   * @param input - Requested field values for the operation.
   * @returns Whether the password was reset successfully.
   */
  @Public()
  @Mutation(() => Boolean)
  async resetPassword(
    @Args("input") input: AuthResetPasswordInput,
  ): Promise<boolean> {
    return await this.authService.resetPassword(input);
  }

  /**
   * Updates the authenticated user's profile.
   * @param input - Requested field values for the operation.
   * @returns Whether the profile update succeeded.
   */
  @Mutation(() => Boolean)
  async updateCurrentUser(
    @Args("input") input: AuthUpdateUserInput,
  ): Promise<boolean> {
    return await this.authService.updateCurrentUser({ ...input });
  }

  /**
   * Starts or completes an authenticated email change.
   * @param input - Requested field values for the operation.
   * @returns Whether the email change request succeeded.
   */
  @Mutation(() => Boolean)
  async changeCurrentUserEmail(
    @Args("input") input: AuthChangeEmailInput,
  ): Promise<boolean> {
    return await this.authService.changeCurrentUserEmail(input);
  }

  /**
   * Changes the authenticated user's password.
   * @param input - Requested field values for the operation.
   * @returns Replacement session token, when the password change issues one.
   */
  @Mutation(() => AuthChangePasswordResultType)
  async changeCurrentUserPassword(
    @Args("input") input: AuthChangePasswordInput,
  ): Promise<AuthChangePasswordResultType> {
    return await this.authService.changeCurrentUserPassword(input);
  }

  /**
   * Adds a credential password to the authenticated account.
   * @param newPassword - New plaintext password to validate and store.
   * @returns Whether the credential password was set successfully.
   */
  @Mutation(() => Boolean)
  async setCurrentUserPassword(
    @Args("newPassword") newPassword: string,
  ): Promise<boolean> {
    return await this.authService.setCurrentUserPassword(newPassword);
  }

  /**
   * Requests deletion of the authenticated user.
   * @param input - Requested field values for the operation.
   * @returns Account deletion status and any redirect information.
   */
  @Mutation(() => AuthDeleteUserResultType)
  async deleteCurrentUser(
    @Args("input", { nullable: true, defaultValue: {} })
    input?: AuthDeleteUserInput,
  ): Promise<AuthDeleteUserResultType> {
    return await this.authService.deleteCurrentUser(input ?? {});
  }

  /**
   * Starts a social or OpenID Connect account-linking flow.
   * @param input - Requested field values for the operation.
   * @returns Account linking response and any provider redirect URL.
   */
  @Mutation(() => AuthLinkSocialAccountResultType)
  async linkCurrentUserAccount(
    @Args("input") input: AuthLinkSocialAccountInput,
  ): Promise<AuthLinkSocialAccountResultType> {
    return await this.authService.linkCurrentUserAccount({
      ...input,
      disableRedirect: true,
    });
  }

  /**
   * Unlinks an authentication account from the current user.
   * @param id - Identifier of the record to access.
   * @returns Whether the provider account was unlinked successfully.
   */
  @Mutation(() => Boolean)
  async unlinkCurrentUserAccount(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<boolean> {
    return await this.authService.unlinkCurrentUserAccount({
      accountId: id,
    });
  }
}

/**
 * Returns graphQL rule objects with actions and subjects normalized to arrays.
 * @param rules - Authorization rules to apply.
 * @returns GraphQL rule objects with actions and subjects normalized to arrays.
 */
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
