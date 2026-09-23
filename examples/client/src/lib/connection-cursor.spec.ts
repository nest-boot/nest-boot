import { describe, expect, it } from "vitest";
import { Cursor } from "../../../../packages/graphql-connection/src/cursor";
import {
  createConnectionCursor,
  encodeConnectionCursor,
} from "./connection-cursor";

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

  it.each([
    { field: "ID", record: { id: "123" }, value: "123" },
    {
      field: "CREATED_AT",
      record: { id: "123", createdAt: "2026-09-23T10:00:00.000Z" },
      value: "2026-09-23T10:00:00.000Z",
    },
    {
      field: "LAST_USED_AT",
      record: { id: "123", lastUsedAt: null },
      value: null,
    },
    { field: "NAME", record: { id: "123", name: "测试 🔑" }, value: "测试 🔑" },
    { field: "COUNT", record: { id: "123", count: 0 }, value: 0 },
  ])(
    "derives the server cursor for $field from record data",
    ({ field, record, value }) => {
      expect(createConnectionCursor(record, { orderBy: { field } })).toBe(
        new Cursor({ id: record.id, value }).toString(),
      );
    },
  );

  it("rejects missing sort data instead of silently falling back to ID pagination", () => {
    expect(() =>
      createConnectionCursor(
        { id: "123" },
        { orderBy: { field: "CREATED_AT" } },
      ),
    ).toThrow('missing the "createdAt" sort field');
  });

  it.each([undefined, null])(
    "matches the server's ID-only cursor without ordering (%s)",
    (orderBy) => {
      expect(createConnectionCursor({ id: "123" }, { orderBy })).toBe(
        new Cursor({ id: "123" }).toString(),
      );
    },
  );
});
