import type { ReactElement, ReactNode } from "react";
import type {
  DataTableColumnProps,
  DataTableField,
  DataTableFieldValue,
  DataTableRender,
  DataTableRenderProps,
} from "./types";

// Distribute over the union to preserve each formatting type's own options.
type ColumnOptions<TColumn> = TColumn extends unknown
  ? Omit<TColumn, "id" | "field" | "getValue"> & { id?: never }
  : never;

type FieldOptions<
  TData extends object,
  TField extends DataTableField<TData>,
> = ColumnOptions<
  DataTableColumnProps<TData, NoInfer<DataTableFieldValue<TData, TField>>>
>;

type ColumnPresentation<TColumn> = TColumn extends unknown
  ? Omit<TColumn, "field" | "getValue">
  : never;

type ColumnSource<
  TData extends object,
  TValue,
  TField,
> = TField extends undefined
  ? {
      readonly field?: never;
      readonly getValue: (row: TData, index: number) => TValue;
    }
  : { readonly field: TField; readonly getValue?: never };

// Type-only metadata preserves the checked source and value across object spreads.
// Column objects remain plain configuration without extra runtime properties.
export type DataTableInferredColumn<
  TData extends object,
  TValue,
  TField extends DataTableField<TData> | null | undefined =
    | DataTableField<TData>
    | null
    | undefined,
> = ColumnPresentation<DataTableColumnProps<TData, TValue>> &
  ColumnSource<TData, TValue, TField> & {
    readonly "~dataTableColumn": {
      readonly value: TValue;
      readonly field: TField;
    };
  };

type InferredColumnInput<
  TData extends object,
  TColumn = DataTableColumnProps<TData>,
> = TColumn extends unknown
  ? Omit<TColumn, "header" | "render"> & {
      readonly "~dataTableColumn": {
        readonly value: unknown;
        readonly field: DataTableField<TData> | null | undefined;
      };
      header?:
        | ReactNode
        | ((props: DataTableRenderProps, state: never) => ReactElement);
      render?: DataTableRender<never>;
    }
  : never;

type ColumnInput<TData extends object> =
  | InferredColumnInput<TData>
  | (DataTableColumnProps<TData> & { "~dataTableColumn"?: never });

type CheckedColumn<TData extends object, TColumn> = TColumn extends {
  readonly "~dataTableColumn": {
    readonly value: infer TValue;
    readonly field: infer TField extends
      | DataTableField<TData>
      | null
      | undefined;
  };
}
  ? DataTableInferredColumn<TData, TValue, TField>
  : unknown;

/** A reusable helper whose inferred return types can be emitted in declarations. */
export interface DataTableColumnHelper<TData extends object> {
  /** Compute a value independently of the column ID. */
  column: (<TValue>(
    id: string,
    options: ColumnOptions<DataTableColumnProps<TData, NoInfer<TValue>>> & {
      getValue: (row: TData, index: number) => TValue;
      field?: never;
    },
  ) => DataTableInferredColumn<TData, TValue, undefined>) &
    (<TField extends DataTableField<TData>>(
      id: string,
      options: FieldOptions<TData, TField> & {
        field: TField;
        getValue?: never;
      },
    ) => DataTableInferredColumn<
      TData,
      DataTableFieldValue<TData, TField>,
      TField
    >) &
    ((
      id: string,
      options: ColumnOptions<DataTableColumnProps<TData, undefined>> & {
        field: null;
        getValue?: never;
      },
    ) => DataTableInferredColumn<TData, undefined, null>) &
    (<TField extends DataTableField<TData>>(
      id: TField,
      options: FieldOptions<TData, TField> & {
        field?: never;
        getValue?: never;
      },
    ) => DataTableInferredColumn<
      TData,
      DataTableFieldValue<TData, TField>,
      TField
    >);
  // Infer each entry first, then recheck its original source/value contract.
  // Wrap the result in NoInfer so heterogeneous array unions still distribute.
  columns: <const TColumns extends Array<ColumnInput<TData>>>(
    columns: [...TColumns] & {
      [K in keyof TColumns]: NoInfer<CheckedColumn<TData, TColumns[K]>>;
    },
  ) => Array<DataTableColumnProps<TData>>;
}

/** Infer cell values from field paths or computed values without exposing the table engine. */
export function createDataTableColumnHelper<
  TData extends object,
>(): DataTableColumnHelper<TData> {
  return {
    column: (<TValue>(
      id: string,
      options: ColumnOptions<DataTableColumnProps<TData, TValue>> & {
        field?: DataTableField<TData> | null;
        getValue?: (row: TData, index: number) => TValue;
      },
    ) => ({
      ...options,
      id,
      field: options.getValue
        ? undefined
        : options.field === undefined
          ? id
          : options.field,
    })) as DataTableColumnHelper<TData>["column"],
    columns(columns) {
      // The helper has checked each inferred callback against its own value.
      return columns as unknown as Array<DataTableColumnProps<TData>>;
    },
  };
}
