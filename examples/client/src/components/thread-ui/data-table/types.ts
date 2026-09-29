import type { HTMLProps } from "@base-ui/react/types";
import type { ReactElement, ReactNode } from "react";

// Bound recursion so recursive row models remain usable by the type checker.
type FieldPath<T, Depth extends Array<unknown> = []> = Depth["length"] extends 6
  ? never
  : unknown extends T
    ? string
    : T extends Date | RegExp | ((...args: Array<never>) => unknown)
      ? never
      : T extends ReadonlyArray<unknown>
        ? number extends T["length"]
          ?
              | `${bigint}`
              | `${bigint}.${FieldPath<T[number], [...Depth, unknown]>}`
          : {
              [K in Exclude<keyof T, keyof ReadonlyArray<unknown>> & string]:
                | K
                | `${K}.${FieldPath<T[K], [...Depth, unknown]>}`;
            }[Exclude<keyof T, keyof ReadonlyArray<unknown>> & string]
        : T extends object
          ? {
              [K in keyof T & (string | number)]:
                | `${K}`
                | `${K}.${FieldPath<T[K], [...Depth, unknown]>}`;
            }[keyof T & (string | number)]
          : never;

/** Object keys and dotted paths, including array indices, up to six segments. */
export type DataTableField<TData extends object> = FieldPath<TData>;

// Only required, explicitly declared keys guarantee a value exists. Open index
// signatures (including template patterns) and optional properties do not.
type DeclaredKeys<T> = keyof {
  [K in keyof T as Record<never, never> extends Pick<T, K>
    ? never
    : K]: unknown;
};

type FieldPart<T, K extends string> = unknown extends T
  ? unknown
  : T extends null | undefined
    ? undefined
    : K extends keyof T
      ? K extends DeclaredKeys<T>
        ? T[K]
        : T[K] | undefined
      : T extends ReadonlyArray<infer Item>
        ? K extends `${bigint}`
          ? Item | undefined
          : undefined
        : K extends `${infer N extends number}`
          ? N extends keyof T
            ? N extends DeclaredKeys<T>
              ? T[N]
              : T[N] | undefined
            : undefined
          : undefined;

/** The raw field value; optional parents, array entries, and dictionary keys include undefined. */
export type DataTableFieldValue<
  TData,
  TField extends string,
> = TField extends `${infer Head}.${infer Tail}`
  ? DataTableFieldValue<FieldPart<TData, Head>, Tail>
  : FieldPart<TData, TField>;

/** Base UI DOM props, including the ref and composed event handlers. */
export type DataTableRenderProps = HTMLProps;

export type DataTableRender<TState> =
  | ReactElement
  | ((props: DataTableRenderProps, state: TState) => ReactElement);

export interface DataTableRowActionState<TData extends object> {
  row: DataTableRow<TData>;
  disabled: boolean;
  highlighted: boolean;
}

/** A row exposed to consumers, independent of the internal table engine. */
export interface DataTableRow<TData extends object> {
  readonly id: string;
  readonly index: number;
  readonly original: TData;
}

export interface DataTableHeaderContext<
  TData extends object,
  TValue = unknown,
> {
  column: DataTableColumnProps<TData, TValue>;
}

export interface DataTableCellContext<
  TData extends object,
  TValue = unknown,
> extends DataTableHeaderContext<TData, TValue> {
  row: DataTableRow<TData>;
  getValue: () => TValue;
}

/** Column options with mutually exclusive field and computed data sources. */
export type DataTableBaseColumnProps<TData extends object, TValue = unknown> = {
  id?: string;
  /** Header content, or a render function receiving DOM props and column context. */
  header?:
    | ReactNode
    | ((
        props: DataTableRenderProps,
        state: DataTableHeaderContext<TData, TValue>,
      ) => ReactElement);
  /** Replaces the content element inside td; forward props to your element. */
  render?: DataTableRender<DataTableCellContext<TData, TValue>>;
  /** Horizontal alignment for the header and cells. Overrides the column type default. */
  align?: "left" | "center" | "right";
  size?: number;
  minSize?: number;
  maxSize?: number;
  pinned?: "left" | "right" | false;
} & (
  | {
      /** Object key or dotted path. Defaults to id; null disables field access. */
      field?: DataTableField<TData> | null;
      getValue?: never;
    }
  | {
      field?: never;
      /** Computes the cell value. Cannot be combined with field, including null. */
      getValue: (row: TData, index: number) => TValue;
    }
);

export type DataTableTextColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type?: "text";
  // Explicitly exclude formatting options when the optional type is omitted.
  locale?: never;
  precision?: never;
  currency?: never;
  timeZone?: never;
  hour12?: never;
  unit?: never;
  style?: never;
};

export type DataTableNumberColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type: "number";
  locale?: string;
  /** Fixed decimal places. Omit to use Intl's default fraction digits. */
  precision?: number;
};

export type DataTableCurrencyColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type: "currency";
  locale?: string;
  /** ISO 4217 currency code. Values use major units, e.g. 12.5 means 12.50 USD. */
  currency: string;
  /** Fixed decimal places. Omit to use the currency's default fraction digits. */
  precision?: number;
};

export type DataTablePercentColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type: "percent";
  locale?: string;
  /** Fixed decimal places in the displayed percentage; 0.125 with 1 becomes 12.5%. */
  precision?: number;
};

export type DataTableDateColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type: "date";
  locale?: string;
  /** IANA time zone for timestamps. Falls back to the table, then runtime default. Date-only strings retain their date. */
  timeZone?: string;
};

export type DataTableDateTimeColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type: "datetime";
  locale?: string;
  /** IANA time zone for timestamps. Falls back to the table, then runtime default. */
  timeZone?: string;
};

export type DataTableTimeColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type: "time";
  locale?: string;
  /** IANA time zone for timestamps. Falls back to the table, then runtime default. */
  timeZone?: string;
  /** Use a 12-hour clock. When omitted, follows the formatting locale. */
  hour12?: boolean;
};

export type DataTableDurationColumnProps<
  TData extends object,
  TValue = unknown,
> = DataTableBaseColumnProps<TData, TValue> & {
  type: "duration";
  locale?: string;
  /** Unit of the numeric input. Defaults to seconds; normalized to millisecond precision. */
  unit?: "milliseconds" | "seconds" | "minutes" | "hours";
  /** Localized duration style. Defaults to digital. */
  style?: "long" | "short" | "narrow" | "digital";
};

export type DataTableColumnProps<TData extends object, TValue = unknown> =
  | DataTableTextColumnProps<TData, TValue>
  | DataTableNumberColumnProps<TData, TValue>
  | DataTableCurrencyColumnProps<TData, TValue>
  | DataTablePercentColumnProps<TData, TValue>
  | DataTableDateColumnProps<TData, TValue>
  | DataTableDateTimeColumnProps<TData, TValue>
  | DataTableTimeColumnProps<TData, TValue>
  | DataTableDurationColumnProps<TData, TValue>;

export interface DataTablePaginationProps {
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}

export interface DataTableRowActionProps<TData extends object> {
  disabled?: boolean;
  icon?: ReactElement;
  label: string;
  render?: DataTableRender<DataTableRowActionState<TData>>;
  onClick?: (row: DataTableRow<TData>) => Promise<void> | void;
}

export interface DataTableProps<TData extends object, TValue = unknown> {
  columns: Array<DataTableColumnProps<TData, TValue>>;
  data: Array<TData>;
  /** Default formatting locale. Falls back to the runtime default; column locale takes precedence. UI labels follow AppProvider. */
  locale?: string;
  /** Default time zone for date/datetime/time columns. Falls back to the runtime default; column timeZone takes precedence. */
  timeZone?: string;
  rowActions?: (
    row: DataTableRow<TData>,
  ) => Array<DataTableRowActionProps<TData>>;
  pagination?: DataTablePaginationProps;
  /** Selection is limited to supplied data; missing row IDs are removed on updates. */
  onRowSelectionChange?: (rows: Array<TData>) => void;
  /** Reports explicit select-all mode; deselection or invalidated selection revokes it. */
  onAllRowsSelectedChange?: (selected: boolean) => void;
  bulkActions?: ReactNode;
  empty?: ReactNode;
  getRowId?: (row: TData, index: number) => string;
  onRowClick?: (row: DataTableRow<TData>) => void;
}
