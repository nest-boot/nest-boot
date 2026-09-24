import { REQUEST, RequestContext } from "@nest-boot/request-context";
import { parseValue } from "graphql";

import type { ConnectionFieldOptions } from "../interfaces/index.js";
import { createFilter } from "./create-filter.js";

interface RecordWithDates {
  createdAt: Date;
  updatedAt: Date;
  owner: { birthday: Date };
  name: string;
  count: number;
}

const fields = new Map<string, ConnectionFieldOptions<RecordWithDates>>([
  [
    "created_at",
    { field: "created_at", type: "date", replacement: "createdAt" },
  ],
  ["updatedAt", { field: "updatedAt", type: "date" }],
  [
    "birthday",
    { field: "birthday", type: "date", replacement: "owner.birthday" },
  ],
  ["name", { field: "name", type: "string" }],
  ["count", { field: "count", type: "number" }],
]);
const { Filter, filterQuerySchema } = createFilter("RecordDates", fields);

function withTimezoneOffset<T>(
  timezoneOffset: string | string[] | undefined,
  action: () => T,
): Promise<T> {
  return RequestContext.run(new RequestContext({ type: "http" }), () => {
    RequestContext.set(REQUEST, {
      headers: { "x-timezone-offset": timezoneOffset },
    });
    return action();
  });
}

describe("connection date-only filters", () => {
  it("reads the request timezone for GraphQL variables and literals and respects aliases", async () => {
    const input = {
      created_at: "2026-09-24",
      updatedAt: { $eq: "2026-09-24" },
    };
    const expectedRange = {
      $gte: "2026-09-23T16:00:00.000Z",
      $lt: "2026-09-24T16:00:00.000Z",
    };
    await withTimezoneOffset("-480", () => {
      expect(Filter.parseValue(input)).toEqual({
        createdAt: expectedRange,
        updatedAt: expectedRange,
      });
      expect(Filter.parseValue(JSON.stringify(input))).toEqual({
        createdAt: expectedRange,
        updatedAt: expectedRange,
      });
      expect(
        Filter.parseLiteral(parseValue('{birthday: "2026-09-24"}')),
      ).toEqual({ owner: { birthday: expectedRange } });
    });
  });

  it.each([
    ["-480", "2026-03-08T16:00:00.000Z"],
    ["240", "2026-03-09T04:00:00.000Z"],
    ["-345", "2026-03-08T18:15:00.000Z"],
  ])(
    "uses the supplied fixed offset %s for calendar boundaries",
    async (offset, next) => {
      await withTimezoneOffset(offset, () => {
        expect(
          Filter.parseValue({ updatedAt: { $lte: "2026-03-08" } }),
        ).toEqual({ updatedAt: { $lt: next } });
      });
    },
  );

  it.each([
    ["2024-02-29", "2024-03-01"],
    ["2100-02-28", "2100-03-01"],
    ["2026-04-30", "2026-05-01"],
    ["2026-12-31", "2027-01-01"],
    ["0000-02-29", "0000-03-01"],
    ["0099-12-31", "0100-01-01"],
  ])("preserves calendar boundaries and the year for %s", (date, next) => {
    expect(Filter.parseValue({ updatedAt: date })).toEqual({
      updatedAt: {
        $gte: `${date}T00:00:00.000Z`,
        $lt: `${next}T00:00:00.000Z`,
      },
    });
  });

  it.each([
    ["-840", "2025-12-31T10:00:00.000Z", "2026-01-01T10:00:00.000Z"],
    ["840", "2026-01-01T14:00:00.000Z", "2026-01-02T14:00:00.000Z"],
    ["1", "2026-01-01T00:01:00.000Z", "2026-01-02T00:01:00.000Z"],
    ["-1", "2025-12-31T23:59:00.000Z", "2026-01-01T23:59:00.000Z"],
  ])(
    "keeps minute offsets exact across year boundaries: %s",
    async (offset, start, next) => {
      await withTimezoneOffset(offset, () => {
        expect(Filter.parseValue({ updatedAt: "2026-01-01" })).toEqual({
          updatedAt: { $gte: start, $lt: next },
        });
      });
    },
  );

  it.each([
    ["$gte", "$gte", "2026-09-23T16:00:00.000Z"],
    ["$gt", "$gte", "2026-09-24T16:00:00.000Z"],
    ["$lt", "$lt", "2026-09-23T16:00:00.000Z"],
    ["$lte", "$lt", "2026-09-24T16:00:00.000Z"],
  ])(
    "expands %s using the user's calendar day",
    async (operator, normalized, bound) => {
      await withTimezoneOffset("-480", () => {
        expect(
          filterQuerySchema.parse({ updatedAt: { [operator]: "2026-09-24" } }),
        ).toEqual({ updatedAt: { [normalized]: bound } });
      });
    },
  );

  it("expands range end dates without overwriting compound constraints", async () => {
    await withTimezoneOffset("-480", () => {
      expect(
        Filter.parseValue({
          created_at: { $between: ["2026-09-01", "2026-09-24"] },
        }),
      ).toEqual({
        $and: [
          { createdAt: { $gte: "2026-08-31T16:00:00.000Z" } },
          { createdAt: { $lt: "2026-09-24T16:00:00.000Z" } },
        ],
      });
      expect(
        Filter.parseValue({
          updatedAt: { $gt: "2026-09-24", $gte: "2026-09-01" },
        }),
      ).toEqual({
        $and: [
          { updatedAt: { $gte: "2026-09-24T16:00:00.000Z" } },
          { updatedAt: { $gte: "2026-08-31T16:00:00.000Z" } },
        ],
      });
    });
  });

  it("retains timestamp precision and leaves non-date fields and nulls unchanged", () => {
    const timestamp = "2026-09-24T14:30:00+08:00";
    expect(
      Filter.parseValue({
        updatedAt: { $lte: timestamp },
        name: "2026-09-24",
        count: { $between: [1, 2] },
        created_at: { $eq: null },
      }),
    ).toEqual({
      updatedAt: { $lte: timestamp },
      name: "2026-09-24",
      count: { $gte: 1, $lte: 2 },
      createdAt: { $eq: null },
    });
    expect(
      Filter.parseValue({ updatedAt: { $between: [timestamp, timestamp] } }),
    ).toEqual({ updatedAt: { $gte: timestamp, $lte: timestamp } });
  });

  it("expands exclusions and lists inside logical filters", () => {
    const range = {
      $gte: "2026-09-24T00:00:00.000Z",
      $lt: "2026-09-25T00:00:00.000Z",
    };
    expect(
      Filter.parseValue({
        $or: [{ updatedAt: { $ne: "2026-09-24" } }, { name: "example" }],
      }),
    ).toEqual({ $or: [{ $not: { updatedAt: range } }, { name: "example" }] });
    expect(
      Filter.parseValue({ updatedAt: { $in: ["2026-09-24", null] } }),
    ).toEqual({ $or: [{ updatedAt: range }, { updatedAt: { $eq: null } }] });
    expect(
      Filter.parseValue({ $not: { birthday: { $nin: ["2026-09-24"] } } }),
    ).toEqual({ $not: { owner: { $not: { $or: [{ birthday: range }] } } } });
  });

  it("uses UTC only without a timezone and isolates concurrent request contexts", async () => {
    const parse = () => Filter.parseValue({ updatedAt: "2026-09-24" });
    expect(parse()).toEqual({
      updatedAt: {
        $gte: "2026-09-24T00:00:00.000Z",
        $lt: "2026-09-25T00:00:00.000Z",
      },
    });
    const [shanghai, newYork] = await Promise.all([
      withTimezoneOffset("-480", async () => {
        await Promise.resolve();
        return parse();
      }),
      withTimezoneOffset("240", async () => {
        await Promise.resolve();
        return parse();
      }),
    ]);
    expect(shanghai).toEqual({
      updatedAt: {
        $gte: "2026-09-23T16:00:00.000Z",
        $lt: "2026-09-24T16:00:00.000Z",
      },
    });
    expect(newYork).toEqual({
      updatedAt: {
        $gte: "2026-09-24T04:00:00.000Z",
        $lt: "2026-09-25T04:00:00.000Z",
      },
    });
  });

  it("rejects invalid dates and operators before normalization", () => {
    for (const value of [
      "2026-02-30",
      "2100-02-29",
      "2026-13-01",
      "2026-00-01",
      "2026/09/24",
      "2026-09-24extra",
      { $between: ["2026-09-01"] },
      { $between: ["2026-09-01", "2026-09-24"], $gte: "2026-09-01" },
      { $unknown: "2026-09-24" },
    ]) {
      expect(() => Filter.parseValue({ updatedAt: value })).toThrow();
    }
  });

  it.each([
    "Asia/Shanghai",
    "",
    "841",
    "-841",
    "1.5",
    "Infinity",
    ["0", "-480"],
  ])("rejects invalid timezone headers: %j", async (timezoneOffset) => {
    await expect(
      withTimezoneOffset(timezoneOffset, () =>
        Filter.parseValue({ updatedAt: "2026-09-24" }),
      ),
    ).rejects.toThrow("Invalid X-Timezone-Offset header");
  });
});
