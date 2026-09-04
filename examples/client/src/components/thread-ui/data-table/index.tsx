"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Column,
  ColumnDef,
  Row,
  RowData,
  RowSelectionState,
  TableOptions,
} from "@tanstack/react-table";
import type { CSSProperties, ReactElement, ReactNode } from "react";

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

function getCommonPinningStyles<TData>(column: Column<TData>): CSSProperties {
  const isPinned = column.getIsPinned();

  return {
    left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    width: column.getSize(),
  };
}

function getCommonPinningClassNames<TData>(column: Column<TData>): string {
  return cn(column.getIsPinned() ? "sticky z-1" : "relative z-0");
}

export interface DataTablePaginationProps {
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
}

export type DataTableColumnProps<
  TData extends RowData,
  TValue = unknown,
> = ColumnDef<TData, TValue> & {
  pinned?: "left" | "right" | false;
};

export interface DataTableRowActionProps<TData extends RowData> {
  disabled?: boolean;
  icon?: ReactElement;
  label: string;
  onClick?: (row: Row<TData>) => Promise<void> | void;
}

export interface DataTableProps<TData extends RowData, TValue = unknown> {
  columns: Array<DataTableColumnProps<TData, TValue>>;
  data: Array<TData>;
  rowActions?: (row: Row<TData>) => Array<DataTableRowActionProps<TData>>;
  pagination?: DataTablePaginationProps;
  onRowSelectionChange?: (rows: Array<TData>) => void;
  onAllRowsSelectedChange?: (selected: boolean) => void;
  bulkActions?: ReactNode;
  empty?: ReactNode;
  getRowId?: TableOptions<TData>["getRowId"];
  onRowClick?: (row: Row<TData>) => void;
}

export function DataTable<TData extends RowData, TValue = unknown>({
  columns,
  data,
  pagination,
  bulkActions,
  empty,
  onRowSelectionChange,
  onAllRowsSelectedChange,
  getRowId = (row, index) =>
    (typeof row === "object" &&
    row !== null &&
    "id" in row &&
    (typeof row.id === "string" || typeof row.id === "number")
      ? row.id
      : index
    ).toString(),
  rowActions,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation("thread-ui");
  const hasRowSelection = !!onRowSelectionChange;
  const hasRowActions = !!rowActions;

  const processedColumns = useMemo(() => {
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
              enableSorting: false,
              enableHiding: false,
              size: 32,
              pinned: "left",
            } satisfies DataTableColumnProps<TData, TValue>,
          ]
        : []),
      ...columns,
      ...(hasRowActions
        ? [
            {
              id: "$actions",
              header: () => null,
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
                    {rowActions?.(row).map((action) => (
                      <DropdownMenuItem
                        key={action.label}
                        disabled={action.disabled}
                        {...(action.onClick
                          ? {
                              onClick: () => action.onClick?.(row),
                            }
                          : {})}
                      >
                        {action.icon}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
              size: 60,
              pinned: "right",
            } satisfies DataTableColumnProps<TData, TValue>,
          ]
        : []),
    ];
  }, [columns, hasRowSelection, hasRowActions, rowActions, t]);

  const tableColumns: Array<ColumnDef<TData, TValue>> = useMemo(() => {
    return processedColumns.map((column) => ({
      accessorKey: column.id,
      ...column,
    }));
  }, [processedColumns]);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isAllPageRowsSelected, setIsAllPageRowsSelected] = useState(false);
  const onRowSelectionChangeRef = useRef(onRowSelectionChange);
  const onAllRowsSelectedChangeRef = useRef(onAllRowsSelectedChange);
  const selectedRowCount = Object.keys(rowSelection).length;

  useEffect(() => {
    onRowSelectionChangeRef.current = onRowSelectionChange;
    onAllRowsSelectedChangeRef.current = onAllRowsSelectedChange;
  }, [onRowSelectionChange, onAllRowsSelectedChange]);

  const table = useReactTable<TData>({
    data,
    columns: tableColumns,
    state: {
      columnPinning: {
        left: processedColumns
          .filter((column) => column.pinned === "left")
          .map((column) => column.id!),
        right: processedColumns
          .filter((column) => column.pinned === "right")
          .map((column) => column.id!),
      },
      rowSelection,
    },
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
  });

  useEffect(() => {
    onRowSelectionChangeRef.current?.(
      table.getSelectedRowModel().rows.map((row) => row.original),
    );
  }, [rowSelection, data.length, table]);

  const handleAllRowsSelectedChange = useCallback((selected: boolean) => {
    setIsAllPageRowsSelected(selected);
    onAllRowsSelectedChangeRef.current?.(selected);
  }, []);

  return (
    <div>
      <div className="relative overflow-auto rounded-md">
        {selectedRowCount > 0 && (
          <div className="bg-background absolute top-0 left-0 z-100 flex h-10 w-full items-center gap-2 px-2">
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
                  <Button size="sm" variant="ghost">
                    {isAllPageRowsSelected
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
                        count: table.getRowCount(),
                      })}
                    </DropdownMenuItem>
                  )}

                  {!isAllPageRowsSelected && (
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

        <Table className="bg-background table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="group bg-background hover:bg-muted"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "bg-background group-hover:bg-muted whitespace-normal",
                      getCommonPinningClassNames<TData>(header.column),
                    )}
                    style={{
                      ...getCommonPinningStyles<TData>(header.column),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
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
                    "group bg-background hover:bg-muted",
                    onRowClick && "cursor-pointer",
                  )}
                  {...(onRowClick ? { onClick: () => onRowClick?.(row) } : {})}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={
                        cell.column.id === "$actions"
                          ? (event) => event.stopPropagation()
                          : undefined
                      }
                      className={cn(
                        "bg-background group-hover:bg-muted whitespace-normal",
                        getCommonPinningClassNames<TData>(cell.column),
                        cell.column.id === "$actions" && "text-right",
                      )}
                      style={{
                        ...getCommonPinningStyles<TData>(cell.column),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="bg-background h-24 text-center"
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
        <div className="flex items-center justify-center py-4">
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
