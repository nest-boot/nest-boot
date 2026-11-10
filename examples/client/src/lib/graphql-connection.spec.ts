import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { Cursor } from "../../../../packages/graphql-connection/src/cursor";
import {
  OrderDirection,
  createCheckboxFilterItemSearchSchema,
  createConnectionCursor,
  createConnectionSearchSchema,
  createDateFilterItemSearchSchema,
  createFilterSchema,
  createInputFilterItemSearchSchema,
  createNumberFilterItemSearchSchema,
  createSelectFilterItemSearchSchema,
  encodeConnectionCursor,
  getNextSearch,
  getPreviousSearch,
} from "./graphql-connection";
import type {
  ConnectionSearch,
  CreateConnectionSearchSchemaOptions,
} from "./graphql-connection";
import { dataFilterDefaultCheckboxOperators } from "@/components/thread-ui/data-filter/utils/data-filter-default-checkbox-operators";
import { dataFilterDefaultDatePickerOperators } from "@/components/thread-ui/data-filter/utils/data-filter-default-date-picker-operators";
import { dataFilterDefaultInputOperators } from "@/components/thread-ui/data-filter/utils/data-filter-default-input-operators";
import { dataFilterDefaultNumberInputOperators } from "@/components/thread-ui/data-filter/utils/data-filter-default-number-input-operators";
import { dataFilterDefaultSelectOperators } from "@/components/thread-ui/data-filter/utils/data-filter-default-select-operators";
import { serializeDataFilterValueFilter } from "@/components/thread-ui/data-filter/utils/data-filter-value";

describe("connection search", () => {
  const start = "2026-09-01T00:00:00.000Z";

  const end = "2026-09-23T00:00:00.000Z";

  const filterCases = [
    {
      name: "input",
      schema: createInputFilterItemSearchSchema(undefined, { fulltext: true }),
      operators: dataFilterDefaultInputOperators,
      value: "name",
      invalid: [{ $gt: "name" }, { $eq: 1 }, "a".repeat(256)],
    },
    {
      name: "select",
      schema: createSelectFilterItemSearchSchema(z.enum(["ACTIVE", "PENDING"])),
      operators: dataFilterDefaultSelectOperators,
      value: ["ACTIVE"],
      invalid: [{ $in: ["UNKNOWN"] }, { $eq: "ACTIVE" }, "ACTIVE"],
    },
    {
      name: "date",
      schema: createDateFilterItemSearchSchema(),
      operators: dataFilterDefaultDatePickerOperators,
      value: start,
      range: [start, end],
      invalid: ["invalid", { $between: [start] }, { $between: [start, null] }],
    },
    {
      name: "number",
      schema: createNumberFilterItemSearchSchema(),
      operators: dataFilterDefaultNumberInputOperators,
      value: 0,
      range: [0, 10],
      invalid: [
        "1",
        Infinity,
        { $between: [0, "10"] },
        { $between: [0, 1, 2] },
      ],
    },
    {
      name: "checkbox",
      schema: createCheckboxFilterItemSearchSchema(),
      operators: dataFilterDefaultCheckboxOperators,
      value: false,
      invalid: ["false", 0, { $gt: true }],
    },
  ];

  describe("DataFilter compatibility", () => {
    it.each(filterCases)(
      "accepts all default $name operators after serialization",
      ({ schema, operators, value, range }) => {
        expect(schema.parse(value)).toEqual(value);
        for (const operator of operators) {
          const condition = {
            [operator]: operator === "$between" ? range : value,
          };
          const serialized = serializeDataFilterValueFilter({
            field: condition,
          });
          expect(serialized).toEqual({ field: condition });
          expect(schema.parse(serialized.field)).toEqual(condition);
        }
      },
    );

    it.each(filterCases)(
      "preserves null equality and tolerates invalid $name search",
      ({ schema, invalid }) => {
        expect(schema.parse({ $eq: null })).toEqual({ $eq: null });
        expect(schema.parse({ $ne: null })).toEqual({ $ne: null });
        for (const value of [...invalid, undefined, null, { $unknown: true }]) {
          expect(schema.parse(value)).toBeUndefined();
        }
      },
    );

    it("accepts date-only calendar values and retains precise timestamps", () => {
      const schema = createDateFilterItemSearchSchema();
      expect(schema.parse("2026-09-24")).toBe("2026-09-24");
      expect(schema.parse({ $between: ["2026-09-01", "2026-09-24"] })).toEqual({
        $between: ["2026-09-01", "2026-09-24"],
      });
      expect(schema.parse(start)).toBe(start);
      expect(schema.parse("2026-02-30")).toBeUndefined();
    });

    it("requires explicit opt-in for fulltext", () => {
      const condition = { $fulltext: "name" };
      expect(
        createInputFilterItemSearchSchema().parse(condition),
      ).toBeUndefined();
      for (const options of [
        {},
        { fulltext: undefined },
        { fulltext: false },
      ]) {
        const schema = createInputFilterItemSearchSchema(undefined, options);
        expect(schema.parse(condition)).toBeUndefined();
        expect(schema.parse({ $eq: "name" })).toEqual({ $eq: "name" });
        expect(schema.parse({ $ne: "name" })).toEqual({ $ne: "name" });
      }
      const schema = createInputFilterItemSearchSchema(z.string().max(4), {
        fulltext: true,
      });
      expect(schema.parse(condition)).toEqual(condition);
      expect(schema.parse({ $fulltext: "too long" })).toBeUndefined();
    });

    it("applies caller constraints", () => {
      const input = createInputFilterItemSearchSchema(z.string().max(3));
      expect(input.parse({ $eq: "abc" })).toEqual({ $eq: "abc" });
      expect(input.parse({ $eq: "abcd" })).toBeUndefined();
      expect(input.parse({ $fulltext: "abc" })).toBeUndefined();
      const number = createNumberFilterItemSearchSchema(
        z.number().int().min(0).max(10),
      );
      expect(number.parse({ $between: [0, 10] })).toEqual({
        $between: [0, 10],
      });
      expect(number.parse({ $between: [0, 11] })).toBeUndefined();
      expect(number.parse(1.5)).toBeUndefined();
      const select = createSelectFilterItemSearchSchema(z.enum(["A", "B"]), 1);
      expect(select.parse({ $in: ["A", "B"] })).toBeUndefined();
    });

    it("keeps both range bounds and discards incomplete ranges", () => {
      const schema = createDateFilterItemSearchSchema();
      const range = { $gte: start, $lte: end };
      expect(schema.parse(range)).toEqual(range);
      const serialized = serializeDataFilterValueFilter({ date: range });
      expect(serialized).toEqual({ date: { $between: [start, end] } });
      expect(schema.parse(serialized.date)).toEqual(serialized.date);
      expect(schema.parse({ $between: [start, undefined] })).toBeUndefined();
      expect(
        serializeDataFilterValueFilter({
          date: { $between: [start, undefined] },
        }),
      ).toEqual({});
    });
  });

  const orderField = { ID: "ID", CREATED_AT: "CREATED_AT" } as const;

  const options = {
    pageSize: 20,
    orderField,
    defaultOrderField: orderField.CREATED_AT,
    defaultOrderDirection: OrderDirection.DESC,
  };

  describe("connection search type inference", () => {
    it("retains filter fields, enum values and optionality through pagination", () => {
      const status = createSelectFilterItemSearchSchema(
        z.enum(["ACTIVE", "PENDING"]),
      );
      const filterSchema = createFilterSchema({
        status,
        enabled: createCheckboxFilterItemSearchSchema(),
      });
      const schemaOptions: CreateConnectionSearchSchemaOptions<
        typeof orderField,
        typeof filterSchema
      > = { ...options, filterSchema };
      const schema = createConnectionSearchSchema(schemaOptions);
      type Search = z.output<typeof schema>;
      expectTypeOf<z.input<typeof schema>["filter"]>().toEqualTypeOf<
        z.input<typeof filterSchema>
      >();
      expectTypeOf<Search["filter"]>().toEqualTypeOf<
        z.output<typeof filterSchema>
      >();
      expectTypeOf<Search>().toEqualTypeOf<
        ConnectionSearch<typeof orderField, typeof filterSchema>
      >();
      expectTypeOf<NonNullable<Search["filter"]>["status"]>().toEqualTypeOf<
        z.output<typeof status>
      >();
      expectTypeOf<
        Extract<z.output<typeof status>, Array<unknown>>
      >().toEqualTypeOf<Array<"ACTIVE" | "PENDING">>();
      expectTypeOf<Search["orderBy"]["field"]>().toEqualTypeOf<
        "ID" | "CREATED_AT"
      >();
      const search = schema.parse({
        filter: { status: { $in: ["ACTIVE"] }, enabled: false },
      });
      const next = getNextSearch(search);
      const previous = getPreviousSearch(search);
      expectTypeOf(next.filter).toEqualTypeOf<Search["filter"]>();
      expectTypeOf(previous.filter).toEqualTypeOf<Search["filter"]>();
      expect(next.filter).toEqual(search.filter);
      expect(previous.filter).toEqual(search.filter);
      expect(schema.parse({}).filter).toBeUndefined();
    });

    it("preserves required filters and transformed input/output types", () => {
      const filterSchema = z.object({ count: z.string().transform(Number) });
      const schema = createConnectionSearchSchema({ ...options, filterSchema });
      expectTypeOf<z.input<typeof schema>["filter"]>().toEqualTypeOf<{
        count: string;
      }>();
      expectTypeOf<z.output<typeof schema>["filter"]>().toEqualTypeOf<{
        count: number;
      }>();
      expect(schema.parse({ filter: { count: "12" } }).filter).toEqual({
        count: 12,
      });
      expect(schema.safeParse({}).success).toBe(false);
    });

    it("preserves filter defaults", () => {
      const filterSchema = z
        .object({ enabled: z.boolean() })
        .default({ enabled: true });
      const schema = createConnectionSearchSchema({ ...options, filterSchema });
      expectTypeOf<z.input<typeof schema>["filter"]>().toEqualTypeOf<
        { enabled: boolean } | undefined
      >();
      expectTypeOf<z.output<typeof schema>["filter"]>().toEqualTypeOf<{
        enabled: boolean;
      }>();
      expect(schema.parse({}).filter).toEqual({ enabled: true });
    });

    it("supports connections without filters and preserves pagination normalization", () => {
      const schema = createConnectionSearchSchema(options);
      type Search = z.output<typeof schema>;
      expectTypeOf<Search>().toEqualTypeOf<
        ConnectionSearch<typeof orderField>
      >();
      expectTypeOf<
        "filter" extends keyof Search ? true : false
      >().toEqualTypeOf<false>();
      const orderBy = { field: "CREATED_AT", direction: OrderDirection.DESC };
      expect(schema.parse({ filter: { ignored: true } })).toEqual({
        first: 20,
        orderBy,
      });
      expect(schema.parse({ before: "cursor" })).toEqual({
        last: 20,
        before: "cursor",
        orderBy,
      });
      expect(
        schema.parse({ first: 2, after: "next", last: 5, before: "previous" }),
      ).toEqual({ first: 2, after: "next", orderBy });
    });
  });

  it("preserves a custom page size when switching direction before schema normalization", () => {
    const search = createConnectionSearchSchema(options).parse({ first: 5 });
    const pageInfo = {
      hasNextPage: true,
      hasPreviousPage: true,
      startCursor: "start",
      endCursor: "end",
    };
    const previous = getPreviousSearch(search, pageInfo);
    const next = getNextSearch(previous, pageInfo);
    expect(next.first).toBe(5);
    expect(getPreviousSearch(next, pageInfo).last).toBe(5);
  });
});

describe("cursor compatibility", () => {
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
      {
        field: "NAME",
        record: { id: "123", name: "测试 🔑" },
        value: "测试 🔑",
      },
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

    it.each([undefined, "ID"])(
      "preserves numeric zero IDs with ordering %s",
      (field) => {
        expect(
          createConnectionCursor(
            { id: 0 },
            { orderBy: field ? { field } : undefined },
          ),
        ).toBe(new Cursor(field ? { id: 0, value: 0 } : { id: 0 }).toString());
      },
    );

    it.each([undefined, null])(
      "matches the server's ID-only cursor without ordering (%s)",
      (orderBy) => {
        expect(createConnectionCursor({ id: "123" }, { orderBy })).toBe(
          new Cursor({ id: "123" }).toString(),
        );
      },
    );
  });
});
