"use client";

import { useRender } from "@base-ui/react/use-render";
import {
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createColumnFormatter, getColumnAlign } from "./format";
import type {
  Column,
  ColumnDef,
  Row,
  RowSelectionState,
} from "@tanstack/react-table";
import type { CSSProperties, ReactNode } from "react";
import type {
  DataTableColumnProps,
  DataTableProps,
  DataTableRender,
  DataTableRow,
  DataTableRowActionProps,
} from "./types";

import { Empty } from "@/components/thread-ui/empty";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type * from "./types";
export { createDataTableColumnHelper } from "./column-helper";
export type {
  DataTableColumnHelper,
  DataTableInferredColumn,
} from "./column-helper";

// Internal render callbacks are render functions, not component types. Keeping
// this component stable preserves child state when column options are recreated.
function TableContent<TContext>({
  render,
  context,
}: {
  render?: ReactNode | ((context: TContext) => ReactNode);
  context: TContext;
}) {
  return typeof render === "function" ? render(context) : render;
}

// Keep table structure/pinning outside the replaceable content element.
function RenderContent<TState extends Record<string, unknown>>({
  render,
  state,
  children,
}: {
  render?: DataTableRender<TState>;
  state: TState;
  children?: ReactNode;
}) {
  return useRender({
    defaultTagName: "span",
    render:
      typeof render === "function"
        ? (props, { context }) => render(props, context)
        : render,
    state: { context: state },
    // Row data and functions belong to the render context, never DOM attributes.
    stateAttributesMapping: { context: () => null },
    props: { children },
  });
}

function RowActionItem<TData extends object>({
  action,
  row,
}: {
  action: DataTableRowActionProps<TData>;
  row: DataTableRow<TData>;
}) {
  const { render } = action;
  return (
    <DropdownMenuItem
      disabled={action.disabled}
      render={
        typeof render === "function"
          ? (props, state) =>
              render(props, {
                row,
                disabled: state.disabled,
                highlighted: state.highlighted,
              })
          : render
      }
      onClick={action.onClick ? () => action.onClick?.(row) : undefined}
    >
      {action.icon}
      {action.label}
    </DropdownMenuItem>
  );
}

const features = tableFeatures({
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
});

type InternalColumn<TData extends object> = ColumnDef<typeof features, TData> &
  Pick<DataTableColumnProps<TData>, "pinned" | "align">;

function publicRow<TData extends object>(
  row: Row<typeof features, TData>,
): DataTableRow<TData> {
  return { id: row.id, index: row.index, original: row.original };
}

function getColumnClassNames<TData extends object>(
  column: Column<typeof features, TData>,
): string {
  const isPinned = column.getIsPinned();
  const { align = "left" } = column.columnDef as InternalColumn<TData>;
  return cn(
    { left: "text-left", center: "text-center", right: "text-right" }[align],
    "w-(--column-width)",
    isPinned ? "sticky z-1" : "relative z-0",
    isPinned === "start" && "left-(--column-offset)",
    isPinned === "end" && "right-(--column-offset)",
  );
}

function defaultGetRowId<TData extends object>(
  row: TData,
  index: number,
): string {
  return (
    "id" in row && (typeof row.id === "string" || typeof row.id === "number")
      ? row.id
      : index
  ).toString();
}

interface SelectionState {
  rows: RowSelectionState;
  all: boolean;
}

export function DataTable<TData extends object, TValue = unknown>({
  columns,
  data,
  locale,
  timeZone,
  pagination,
  bulkActions,
  empty,
  onRowSelectionChange,
  onAllRowsSelectedChange,
  getRowId = defaultGetRowId,
  rowActions,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation("thread-ui");
  const hasRowSelection = !!onRowSelectionChange;
  const hasRowActions = !!rowActions;

  const tableColumns = useMemo(() => {
    return [
      ...(hasRowSelection
        ? [
            {
              id: "$select",
              header: ({ table }) => (
                <Checkbox
                  aria-label={t("dataTable.selectAllRows")}
                  checked={table.getIsAllPageRowsSelected()}
                  onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                  }
                />
              ),
              cell: ({ row }) => (
                <Checkbox
                  aria-label={t("dataTable.selectRow")}
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  onClick={(event) => event.stopPropagation()}
                />
              ),
              enableHiding: false,
              size: 32,
              pinned: "left",
            } satisfies InternalColumn<TData>,
          ]
        : []),
      ...columns.map((column, index): InternalColumn<TData> => {
        const format = createColumnFormatter(column, locale, timeZone);
        return {
          id: column.id ?? column.field ?? `column_${index}`,
          accessorKey:
            column.field === null ? undefined : (column.field ?? column.id),
          accessorFn: column.getValue,
          size: column.size,
          minSize: column.minSize,
          maxSize: column.maxSize,
          pinned: column.pinned,
          align: getColumnAlign(column),
          header: () =>
            typeof column.header === "function" ? (
              <RenderContent render={column.header} state={{ column }} />
            ) : (
              column.header
            ),
          cell: (context) => {
            // Read the current accessor once. TanStack's per-row value cache is
            // keyed by column ID and can outlive changes to field/getValue.
            const value = context.column.accessorFn?.(
              context.row.original,
              context.row.index,
            ) as TValue;
            return (
              <RenderContent
                render={column.render}
                state={{
                  column,
                  row: publicRow(context.row),
                  getValue: () => value,
                }}
              >
                {format(value)}
              </RenderContent>
            );
          },
        };
      }),
      ...(hasRowActions
        ? [
            {
              id: "$actions",
              header: () => (
                <span className="sr-only">{t("dataTable.openRowActions")}</span>
              ),
              cell: ({ row }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        aria-label={t("dataTable.openRowActions")}
                        className="cursor-pointer"
                        size="icon"
                        variant="ghost"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    {rowActions?.(publicRow(row)).map((action) => (
                      <RowActionItem
                        key={action.label}
                        action={action}
                        row={publicRow(row)}
                      />
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
              size: 60,
              pinned: "right",
              align: "right",
            } satisfies InternalColumn<TData>,
          ]
        : []),
    ];
  }, [
    columns,
    hasRowSelection,
    hasRowActions,
    rowActions,
    t,
    locale,
    timeZone,
  ]);

  const currentRowIds = useMemo(
    () => new Set(data.map(getRowId)),
    [data, getRowId],
  );
  const [selection, setSelection] = useState<SelectionState>({
    rows: {},
    all: false,
  });
  const rowSelection = selection.rows;
  const allRowsSelected = selection.all;
  const selectedIds = Object.keys(rowSelection);
  const hasMissingRows = selectedIds.some((id) => !currentRowIds.has(id));
  const allCurrentRowsSelected =
    currentRowIds.size > 0 &&
    [...currentRowIds].every((id) => rowSelection[id]);

  // Reconcile before rendering the table so the toolbar and callbacks always
  // describe the supplied data. Returning to an old page must not revive IDs.
  if (
    hasMissingRows ||
    (allRowsSelected && !allCurrentRowsSelected) ||
    (!hasRowSelection && selectedIds.length > 0)
  ) {
    setSelection({
      rows: hasRowSelection
        ? Object.fromEntries(
            selectedIds
              .filter((id) => currentRowIds.has(id))
              .map((id) => [id, true]),
          )
        : {},
      all: false,
    });
  }

  const handleRowSelectionChange = useCallback(
    (
      update:
        | RowSelectionState
        | ((previous: RowSelectionState) => RowSelectionState),
    ) => {
      setSelection((current) => {
        const next =
          typeof update === "function" ? update(current.rows) : update;
        const rows = Object.fromEntries(
          Object.entries(next).filter(
            ([id, selected]) => selected && currentRowIds.has(id),
          ),
        );
        return {
          rows,
          all: current.all && Object.keys(current.rows).every((id) => rows[id]),
        };
      });
    },
    [currentRowIds],
  );

  const onRowSelectionChangeRef = useRef(onRowSelectionChange);
  const onAllRowsSelectedChangeRef = useRef(onAllRowsSelectedChange);
  const selectedRowCount = selectedIds.length;

  useEffect(() => {
    onRowSelectionChangeRef.current = onRowSelectionChange;
    onAllRowsSelectedChangeRef.current = onAllRowsSelectedChange;
  }, [onRowSelectionChange, onAllRowsSelectedChange]);

  const table = useTable({
    features,
    data,
    columns: tableColumns,
    state: {
      columnPinning: {
        start: tableColumns
          .filter((column) => column.pinned === "left")
          .map((column) => column.id!),
        end: tableColumns
          .filter((column) => column.pinned === "right")
          .map((column) => column.id!),
      },
      rowSelection,
    },
    getRowId,
    onRowSelectionChange: handleRowSelectionChange,
  });

  const lastSelectedRows = useRef<Array<TData> | undefined>(undefined);
  useEffect(() => {
    const rows = table.getSelectedRowModel().rows.map((row) => row.original);
    const previous = lastSelectedRows.current;
    if (
      !previous ||
      previous.length !== rows.length ||
      rows.some((row, index) => row !== previous[index])
    ) {
      lastSelectedRows.current = rows;
      onRowSelectionChangeRef.current?.(rows);
    }
  }, [rowSelection, data, table]);

  const previousAllRowsSelected = useRef(false);
  useEffect(() => {
    if (previousAllRowsSelected.current !== allRowsSelected) {
      previousAllRowsSelected.current = allRowsSelected;
      onAllRowsSelectedChangeRef.current?.(allRowsSelected);
    }
  }, [allRowsSelected]);

  const handleAllRowsSelectedChange = useCallback((all: boolean) => {
    setSelection((current) => ({ ...current, all }));
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-auto rounded-md">
        {selectedRowCount > 0 && (
          <div className="bg-card absolute top-0 left-0 z-100 flex h-10 w-full items-center gap-2 px-2">
            <Checkbox
              aria-label={t("dataTable.selectAllRows")}
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button size="xs" variant="ghost">
                    {allRowsSelected
                      ? t("dataTable.allSelected")
                      : t("dataTable.selectedRows", {
                          count: selectedRowCount,
                        })}
                    <ChevronDown />
                  </Button>
                }
              />
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  {!table.getIsAllPageRowsSelected() && (
                    <DropdownMenuItem
                      onClick={() => table.toggleAllPageRowsSelected(true)}
                    >
                      {t("dataTable.selectAllRowsOnPage", {
                        count: table.getRowModel().rows.length,
                      })}
                    </DropdownMenuItem>
                  )}

                  {!allRowsSelected && (
                    <DropdownMenuItem
                      onClick={() => {
                        table.toggleAllPageRowsSelected(true);
                        handleAllRowsSelectedChange(true);
                      }}
                    >
                      {t("dataTable.selectAll")}
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => {
                      table.toggleAllPageRowsSelected(false);
                      handleAllRowsSelectedChange(false);
                    }}
                  >
                    {t("dataTable.unselectAll")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {bulkActions}
          </div>
        )}

        <Table className="bg-card table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="group bg-card hover:bg-muted"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={
                      {
                        "--column-width": `${header.column.getSize()}px`,
                        "--column-offset": `${header.column.getIsPinned() === "end" ? header.column.getAfter("end") : header.column.getStart("start")}px`,
                      } as CSSProperties
                    }
                    className={cn(
                      "bg-card group-hover:bg-muted whitespace-normal",
                      getColumnClassNames<TData>(header.column),
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <TableContent
                        context={header.getContext()}
                        render={header.column.columnDef.header}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(
                    "group bg-card hover:bg-muted",
                    onRowClick && "cursor-pointer",
                  )}
                  {...(onRowClick
                    ? { onClick: () => onRowClick?.(publicRow(row)) }
                    : {})}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={
                        {
                          "--column-width": `${cell.column.getSize()}px`,
                          "--column-offset": `${cell.column.getIsPinned() === "end" ? cell.column.getAfter("end") : cell.column.getStart("start")}px`,
                        } as CSSProperties
                      }
                      className={cn(
                        "bg-card group-hover:bg-muted whitespace-normal",
                        getColumnClassNames<TData>(cell.column),
                      )}
                      onClick={
                        cell.column.id === "$actions"
                          ? (event) => event.stopPropagation()
                          : undefined
                      }
                    >
                      <TableContent
                        context={cell.getContext()}
                        render={cell.column.columnDef.cell}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="bg-card h-24 text-center"
                  colSpan={tableColumns.length}
                >
                  {empty ?? (
                    <Empty
                      description={t("dataTable.emptyDescription")}
                      title={t("dataTable.emptyTitle")}
                    />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-center">
          <ButtonGroup>
            <Button
              aria-label={t("dataTable.previousPage")}
              disabled={!pagination.hasPreviousPage}
              size="icon"
              variant="outline"
              onClick={pagination.onPreviousPage}
            >
              <ChevronLeft />
            </Button>
            <Button
              aria-label={t("dataTable.nextPage")}
              disabled={!pagination.hasNextPage}
              size="icon"
              variant="outline"
              onClick={pagination.onNextPage}
            >
              <ChevronRight />
            </Button>
          </ButtonGroup>
        </div>
      )}
    </div>
  );
}
