"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Lead } from "@/lib/types";

function statusLabel(status: Lead["status"]): string {
  if (status === "sent") return "Sent";
  if (status === "failed") return "Didn't send";
  return "Waiting";
}

function statusVariant(
  status: Lead["status"]
): "success" | "warning" | "destructive" | "secondary" {
  if (status === "sent") return "success";
  if (status === "failed") return "destructive";
  return "warning";
}

type LeadsTableMeta = {
  expandedLeadId: number | null;
  toggleExpand: (id: number) => void;
};

export function LeadsTable({
  leads,
  emptyLabel,
}: {
  leads: Lead[];
  /** Shown when there are zero rows (e.g. empty tab filter). */
  emptyLabel?: string;
}) {
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedLeadId((cur) => (cur === id ? null : id));
  };

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      {
        accessorKey: "author",
        header: "Poster",
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
        header: "Post preview",
        cell: ({ row }) => (
          <span className="max-w-[min(22rem,50vw)] text-muted-foreground line-clamp-2">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <Badge variant={statusVariant(row.original.status)}>
              {statusLabel(row.original.status)}
            </Badge>
            {row.original.status === "failed" && row.original.lastError ? (
              <span className="max-w-48 text-xs text-destructive sm:max-w-xs wrap-break-word">
                {row.original.lastError}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row, table }) => {
          const lead = row.original;
          const meta = table.options.meta as LeadsTableMeta | undefined;
          const open = meta?.expandedLeadId === lead.id;
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 whitespace-nowrap"
              aria-expanded={open ? "true" : "false"}
              aria-controls={`jd-detail-${lead.id}`}
              id={`jd-toggle-${lead.id}`}
              onClick={() => meta?.toggleExpand(lead.id)}
            >
              {open ? (
                <>
                  <ChevronUp className="size-4 shrink-0" aria-hidden />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="size-4 shrink-0" aria-hidden />
                  Full post
                </>
              )}
            </Button>
          );
        },
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
    meta: {
      expandedLeadId,
      toggleExpand,
    } satisfies LeadsTableMeta,
  });

  const colCount = columns.length;

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
          table.getRowModel().rows.map((row) => {
            const lead = row.original;
            const expanded = expandedLeadId === lead.id;
            return (
              <Fragment key={row.id}>
                <TableRow>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {expanded ? (
                  <TableRow className="bg-muted/25 hover:bg-muted/25">
                    <TableCell
                      colSpan={colCount}
                      className="border-t-0 pt-0"
                      id={`jd-detail-${lead.id}`}
                      role="region"
                      aria-labelledby={`jd-toggle-${lead.id}`}
                    >
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Full post / job text
                      </p>
                      <div className="max-h-[min(70vh,32rem)] overflow-y-auto rounded-md border border-border bg-background p-3 text-sm leading-relaxed text-foreground">
                        <pre className="whitespace-pre-wrap wrap-break-word font-sans">
                          {lead.description}
                        </pre>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={colCount}
              className="h-24 text-center text-muted-foreground"
            >
              {emptyLabel ??
                "No contacts yet. Import a spreadsheet (.csv) to get started."}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
