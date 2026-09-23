import { describe, expect, it } from "vitest";
import { Cursor } from "../../../../packages/graphql-connection/src/cursor";
import { encodeConnectionCursor } from "./connection-cursor";

describe("browser connection cursor", () => {
  it.each([
    { id: "123" },
    { id: "123", value: "123" },
    { id: "123", value: "2026-09-23T10:00:00.000Z" },
    { id: "123", value: null },
    { id: "123", value: "测试 🔑" },
  ])("matches the server cursor format for %j", (position) => {
    expect(encodeConnectionCursor(position)).toBe(
      new Cursor(position).toString(),
    );
  });
});
