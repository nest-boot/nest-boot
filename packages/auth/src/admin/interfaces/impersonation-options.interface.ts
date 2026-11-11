/** Client metadata stored when an administrator starts impersonation. */
export interface ImpersonationOptions {
  /** Client IP address. */
  ipAddress?: string;
  /** Client User-Agent value. */
  userAgent?: string;
}
