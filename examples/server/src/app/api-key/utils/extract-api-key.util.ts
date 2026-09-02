import { Request } from 'express';

/**
 * 从 Express 请求中提取 API Key 明文。
 *
 * @param request - Express 请求对象；为空时返回空值。
 * @returns 请求中携带的 API Key 明文。
 */
export function extractApiKey(
  request: Request | null | undefined,
): string | null {
  if (!request) {
    return null;
  }

  const authorization =
    request.headers.authorization ?? request.headers.Authorization;

  if (typeof authorization === 'string') {
    const bearerPrefix = 'Bearer ';

    if (authorization.startsWith(bearerPrefix)) {
      return authorization.slice(bearerPrefix.length).trim() || null;
    }
  }

  const headerApiKey = request.headers['x-api-key'];

  return typeof headerApiKey === 'string' && headerApiKey ? headerApiKey : null;
}
