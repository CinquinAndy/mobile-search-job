"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpDown, Reply } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/types/application";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Resend email events
  queued: {
    label: "Queued",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  },
  sent: {
    label: "Sent",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  delivered: {
    label: "Delivered",
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  opened: {
    label: "Opened",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  clicked: {
    label: "Clicked",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  delivery_delayed: {
    label: "Delayed",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  bounced: {
    label: "Bounced",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  complained: {
    label: "Spam",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  canceled: {
    label: "Canceled",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400",
  },
  suppressed: {
    label: "Suppressed",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400",
  },
  // Custom application statuses
  responded: {
    label: "Responded",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  interview: {
    label: "Interview",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  offer: {
    label: "Offer!",
    className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  },
  rejected: {
    label: "Rejected",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400",
  },
};

export const columns: ColumnDef<JobApplication>[] = [
  {
    accessorKey: "company",
    header: ({ column }) => (
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground transition-colors uppercase text-[10px] font-bold tracking-wider"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Company
        <ArrowUpDown className="h-3 w-3" />
      </button>
    ),
    cell: ({ row }) => {
      const { company, position, id, lastResponseAt, lastActivityAt } = row.original;
      const hasRecentResponse = lastResponseAt && lastActivityAt && lastResponseAt === lastActivityAt;

      return (
        <Link href={`/applications/${id}`} className="flex flex-col group py-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground group-hover:text-primary transition-colors">
              {company}
            </span>
            {hasRecentResponse && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 text-[8px] font-bold uppercase tracking-tight border border-green-500/20">
                <Reply className="w-2 h-2" />
                Response
              </span>
            )}
          </div>
          {position && (
            <span className="text-[10px] text-muted-foreground group-hover:text-muted-foreground/80 leading-tight">
              {position}
            </span>
          )}
        </Link>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const config = STATUS_CONFIG[status] || {
        label: status,
        className: "bg-zinc-100 text-zinc-700",
      };
      return (
        <span
          className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide",
            config.className,
          )}
        >
          {config.label}
        </span>
      );
    },
  },
  {
    accessorKey: "lastActivityAt",
    header: "Last Activity",
    cell: ({ row }) => {
      const dateValue = row.getValue("lastActivityAt") as string;
      if (!dateValue) {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      return (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(date, { addSuffix: true })}
        </span>
      );
    },
  },
  {
    accessorKey: "followUpCount",
    header: "F-ups",
    cell: ({ row }) => {
      const count = row.getValue("followUpCount") as number;
      return (
        <span className="text-xs font-mono font-bold text-muted-foreground">
          {count}
        </span>
      );
    },
  },
];
