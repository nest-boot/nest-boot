/**
 * Determines whether a queue should be included.
 * @param queueName - The queue name.
 * @param includeQueues - List of queues to include (empty means include all).
 * @param excludeQueues - List of queues to exclude.
 * @returns True if the queue should be included.
 *
 * Rules:
 * 1. If in excludeQueues, return false.
 * 2. If includeQueues is empty, return true (include all non-excluded queues).
 * 3. If in includeQueues, return true.
 * 4. Otherwise return false.
 */
export function shouldIncludeQueue(
  queueName: string,
  includeQueues: string[],
  excludeQueues: string[],
): boolean {
  // Check exclude list first (takes priority)
  if (excludeQueues.includes(queueName)) {
    return false;
  }

  // If no include list is specified, include all non-excluded queues
  if (includeQueues.length === 0) {
    return true;
  }

  // Check if in include list
  return includeQueues.includes(queueName);
}
