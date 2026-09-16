import { vi } from "vitest";

// Unit tests freeze and rewind time; keep generated IDs independent of that clock.
vi.mock("sonyflake-js", () => {
  let id = 0n;
  return { Sonyflake: { next: () => ++id } };
});
