/** Options for banning a user. */
export interface BanUserOptions {
  /** Optional reason displayed for the ban. */
  banReason?: string;
  /** Positive integer ban duration in seconds; omission creates a permanent ban. */
  banExpiresIn?: number;
}
