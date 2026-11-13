/** Provider user information returned for a linked authentication account. */
export interface AuthProviderUserInfo {
  /** Provider display name, when supplied. */
  name?: string;
  /** Provider email address, when supplied. */
  email?: string | null;
  /** Whether the provider considers the email verified. */
  emailVerified: boolean;
  /** Provider avatar URL, when supplied. */
  image?: string;
  /** Provider-defined user-info fields. */
  [field: string]: unknown;
}
