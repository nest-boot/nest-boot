import { shouldIncludeQueue } from "./should-include-queue.util";

describe("shouldIncludeQueue", () => {
  describe("when no filters are set", () => {
    it("should include all queues", () => {
      expect(shouldIncludeQueue("any-queue", [], [])).toBe(true);
      expect(shouldIncludeQueue("test-queue", [], [])).toBe(true);
    });
  });

  describe("when only excludeQueues is set", () => {
    const excludeQueues = ["debug-queue", "test-queue"];

    it("should exclude queues in the list", () => {
      expect(shouldIncludeQueue("debug-queue", [], excludeQueues)).toBe(false);
      expect(shouldIncludeQueue("test-queue", [], excludeQueues)).toBe(false);
    });

    it("should include queues not in the list", () => {
      expect(shouldIncludeQueue("production-queue", [], excludeQueues)).toBe(
        true,
      );
      expect(shouldIncludeQueue("email-queue", [], excludeQueues)).toBe(true);
    });
  });

  describe("when only includeQueues is set", () => {
    const includeQueues = ["email-queue", "notification-queue"];

    it("should include queues in the list", () => {
      expect(shouldIncludeQueue("email-queue", includeQueues, [])).toBe(true);
      expect(shouldIncludeQueue("notification-queue", includeQueues, [])).toBe(
        true,
      );
    });

    it("should exclude queues not in the list", () => {
      expect(shouldIncludeQueue("debug-queue", includeQueues, [])).toBe(false);
      expect(shouldIncludeQueue("other-queue", includeQueues, [])).toBe(false);
    });
  });

  describe("when both includeQueues and excludeQueues are set", () => {
    const includeQueues = ["email-queue", "notification-queue", "debug-queue"];
    const excludeQueues = ["debug-queue"];

    it("excludeQueues should take priority over includeQueues", () => {
      // debug-queue is in includeQueues but also in excludeQueues
      // it should be excluded
      expect(
        shouldIncludeQueue("debug-queue", includeQueues, excludeQueues),
      ).toBe(false);
    });

    it("should include queues in includeQueues but not in excludeQueues", () => {
      expect(
        shouldIncludeQueue("email-queue", includeQueues, excludeQueues),
      ).toBe(true);
      expect(
        shouldIncludeQueue("notification-queue", includeQueues, excludeQueues),
      ).toBe(true);
    });

    it("should exclude queues not in includeQueues", () => {
      expect(
        shouldIncludeQueue("other-queue", includeQueues, excludeQueues),
      ).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string queue names", () => {
      expect(shouldIncludeQueue("", [], [])).toBe(true);
      expect(shouldIncludeQueue("", [""], [])).toBe(true);
      expect(shouldIncludeQueue("", [], [""])).toBe(false);
    });

    it("should be case-sensitive", () => {
      const includeQueues = ["Email-Queue"];
      expect(shouldIncludeQueue("email-queue", includeQueues, [])).toBe(false);
      expect(shouldIncludeQueue("Email-Queue", includeQueues, [])).toBe(true);
    });
  });
});
