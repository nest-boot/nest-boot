import { shouldIncludeQueue } from "./should-include-queue.util";

describe("shouldIncludeQueue", () => {
  describe("当没有设置任何过滤器", () => {
    it("应该包含所有队列", () => {
      expect(shouldIncludeQueue("any-queue", [], [])).toBe(true);
      expect(shouldIncludeQueue("test-queue", [], [])).toBe(true);
    });
  });

  describe("当只设置了 excludeQueues", () => {
    const excludeQueues = ["debug-queue", "test-queue"];

    it("应该排除在列表中的队列", () => {
      expect(shouldIncludeQueue("debug-queue", [], excludeQueues)).toBe(false);
      expect(shouldIncludeQueue("test-queue", [], excludeQueues)).toBe(false);
    });

    it("应该包含不在列表中的队列", () => {
      expect(shouldIncludeQueue("production-queue", [], excludeQueues)).toBe(
        true,
      );
      expect(shouldIncludeQueue("email-queue", [], excludeQueues)).toBe(true);
    });
  });

  describe("当只设置了 includeQueues", () => {
    const includeQueues = ["email-queue", "notification-queue"];

    it("应该包含在列表中的队列", () => {
      expect(shouldIncludeQueue("email-queue", includeQueues, [])).toBe(true);
      expect(shouldIncludeQueue("notification-queue", includeQueues, [])).toBe(
        true,
      );
    });

    it("应该排除不在列表中的队列", () => {
      expect(shouldIncludeQueue("debug-queue", includeQueues, [])).toBe(false);
      expect(shouldIncludeQueue("other-queue", includeQueues, [])).toBe(false);
    });
  });

  describe("当同时设置了 includeQueues 和 excludeQueues", () => {
    const includeQueues = ["email-queue", "notification-queue", "debug-queue"];
    const excludeQueues = ["debug-queue"];

    it("excludeQueues 应该优先于 includeQueues", () => {
      // debug-queue 在 includeQueues 中，但也在 excludeQueues 中
      // 应该被排除
      expect(
        shouldIncludeQueue("debug-queue", includeQueues, excludeQueues),
      ).toBe(false);
    });

    it("应该包含在 includeQueues 中且不在 excludeQueues 中的队列", () => {
      expect(
        shouldIncludeQueue("email-queue", includeQueues, excludeQueues),
      ).toBe(true);
      expect(
        shouldIncludeQueue("notification-queue", includeQueues, excludeQueues),
      ).toBe(true);
    });

    it("应该排除不在 includeQueues 中的队列", () => {
      expect(
        shouldIncludeQueue("other-queue", includeQueues, excludeQueues),
      ).toBe(false);
    });
  });

  describe("边界情况", () => {
    it("应该处理空字符串队列名", () => {
      expect(shouldIncludeQueue("", [], [])).toBe(true);
      expect(shouldIncludeQueue("", [""], [])).toBe(true);
      expect(shouldIncludeQueue("", [], [""])).toBe(false);
    });

    it("应该区分大小写", () => {
      const includeQueues = ["Email-Queue"];
      expect(shouldIncludeQueue("email-queue", includeQueues, [])).toBe(false);
      expect(shouldIncludeQueue("Email-Queue", includeQueues, [])).toBe(true);
    });
  });
});
