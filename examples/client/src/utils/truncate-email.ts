/**
 * 截取邮箱地址，保留前8位字符和域名部分
 * @param email 邮箱地址
 * @returns 截取后的邮箱地址
 */
export function truncateEmail(email: string | null | undefined): string {
  if (!email || email === "-") {
    return "-";
  }

  // 如果邮箱长度较短，不需要截取
  if (email.length <= 40) {
    return email;
  }

  // 使用正则表达式匹配邮箱格式：前8位字符 + 中间部分 + @域名
  const match = email.match(/^(.{8})(.*)(@.+)$/);

  if (match && match[2] && match[2].length > 0) {
    // 如果匹配成功且中间部分存在，用省略号替换中间部分
    return `${match[1]}...${match[3]}`;
  }

  // 如果不匹配邮箱格式，返回原邮箱
  return email;
}
