function withProtocol(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export const siteUrl = new URL(
  withProtocol(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL ??
      "nest-boot.vercel.app",
  ),
);
