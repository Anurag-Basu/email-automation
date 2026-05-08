"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Lead } from "@/lib/types";

function statusVariant(
  status: Lead["status"]
): "success" | "warning" | "destructive" | "secondary" {
  if (status === "sent") return "success";
  if (status === "failed") return "destructive";
  return "warning";
}

function categoryVariant(
  c: Lead["category"]
): "default" | "secondary" {
  return c === "fullstack" ? "secondary" : "default";
}

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "author",
        header: "Author",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">{row.original.author}</span>
        ),
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <a
            className="text-primary underline-offset-4 hover:underline break-all"
            href={`mailto:${row.original.email}`}
          >
            {row.original.email}
          </a>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="max-w-[min(28rem,55vw)] text-muted-foreground line-clamp-2">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <Badge variant={categoryVariant(row.original.category)}>
            {row.original.category}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <Badge variant={statusVariant(row.original.status)}>
              {row.original.status}
            </Badge>
            {row.original.status === "failed" && row.original.lastError ? (
              <span className="text-xs text-destructive max-w-[12rem] sm:max-w-xs break-words">
                {row.original.lastError}
              </span>
            ) : null}
          </div>
        ),
      },
    ],
    []
  );

  // TanStack Table returns unstable function refs; safe here since data/columns drive rows.
  // eslint-disable-next-line react-hooks/incompatible-library -- useReactTable
  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-muted-foreground"
            >
              No leads yet. Upload a CSV to get started.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
