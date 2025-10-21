/**
 * 判断队列是否应该被包含
 * @param queueName 队列名称
 * @param includeQueues 包含的队列列表（为空表示包含所有）
 * @param excludeQueues 排除的队列列表
 * @returns 如果队列应该被包含则返回 true
 *
 * 规则：
 * 1. 如果在 excludeQueues 中，返回 false
 * 2. 如果 includeQueues 为空，返回 true（包含所有未排除的队列）
 * 3. 如果在 includeQueues 中，返回 true
 * 4. 否则返回 false
 */
export function shouldIncludeQueue(
  queueName: string,
  includeQueues: string[],
  excludeQueues: string[],
): boolean {
  // 优先检查排除列表
  if (excludeQueues.includes(queueName)) {
    return false;
  }

  // 如果没有指定包含列表，则包含所有未排除的队列
  if (includeQueues.length === 0) {
    return true;
  }

  // 检查是否在包含列表中
  return includeQueues.includes(queueName);
}
