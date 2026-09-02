import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";

dayjs.extend(relativeTime);
dayjs.extend(duration);

/**
 * 格式化剩余时间
 * @param expiresAt 过期时间
 * @returns 格式化的剩余时间字符串，如果已过期返回 "EXPIRED" 标记
 */
export function formatTimeRemaining(
  expiresAt: Date | string | null | undefined,
): string {
  if (!expiresAt) {
    return "-";
  }

  const now = dayjs();
  const expires = dayjs(expiresAt);

  if (expires.isBefore(now)) {
    return "EXPIRED";
  }

  const diff = expires.diff(now, "second");
  const dur = dayjs.duration(diff, "seconds");

  const days = Math.floor(dur.asDays());
  const hours = dur.hours();
  const minutes = dur.minutes();

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours > 1 ? "s" : ""}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
}
